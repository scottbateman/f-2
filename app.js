
/**
 * Module dependencies.
 */

var config = require('./config');
var express = require('express');
var http = require('http');
var path = require('path');
var join = path.join;
var os = require('os');

var holla = require('holla');
var io = require('socket.io').listen(config.ioSocketPort);
var fs=require('fs');
var im = require('imagemagick');

//////////////////////////////////////
// Database
var mongo = require('mongodb');
var json2csv = require('json2csv');
var mongoSV = new mongo.Server(config.mongoDB.ip, config.mongoDB.port, {auto_reconnect: true});
var mongoDB = new mongo.Db(config.mongoDB.name, mongoSV);
var mongoLog = undefined;

mongoDB.open(function(err, mongoDB) {
    if(!err) {
        console.log("Connected to database");
        mongoDB.collection(config.mongoDB.log_collection, function(err, collectionref) {
            if (!err) {
                mongoLog = collectionref;
                mongoLog.find({},function(err, logs) {
                    logs.each(function (err, log) {
                            //console.log(log);
                        }
                    );
                    logs.toArray(function(err, array) {
                        var intCount = array.length;
                        if(intCount > 0) {
                            var strJson = "";
                            for (var i = 0; i < intCount;) {
                                var info = array[i].info? JSON.stringify(array[i].info): '" "';
                                strJson += '{"event_type":"' + array[i].event_type + '"' +
                                           ',"user_id":"' + array[i].user_id + '"' +
                                           ',"time_stamp":"' + array[i].time_stamp + '"' +
                                           ',"info":' + info  +
                                           '}';
                                i = i + 1;
                                if (i < intCount) {
                                    strJson += ',';
                                }
                            }
                            strJson = '[' + strJson + "]";
                            json2csv({data: JSON.parse(strJson), fields: ['event_type', 'user_id', 'time_stamp', 'info']}, function(err, csv) {
                                if (err) console.log(err);
                                fs.writeFile(__dirname+'/database/log.csv', csv, function(err) {
                                    if (err) throw err;
                                    console.log('csv file saved');
                                });
                            });

                        }
                    });
                });
            }
            else
                console.log('Could not find mongodb Log collection');
        });
    }
    else {
        console.log("Could not connect to database");
        console.log(err);
    }
});
////////////////////////////////////

var app = express();

var IP = (function() {
   var iface = os.networkInterfaces().wlp3s0;
   var ip;
   if (iface) {
      iface.forEach(function(connection) {
         if (connection.family === 'IPv4') {
            ip = connection.address;
         }
      });
   }
   return ip;
}());

app.set('ip', process.argv[2] || process.env.IP || IP || config.web.ip);
app.set('port', process.argv[3] || process.env.PORT || config.web.port);

app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(join(__dirname, 'public')));
app.use(express.errorHandler());

var server = http.createServer(app).listen(app.get('port'), function(){
   console.log('Express server on ' + app.get('ip') + ':' + app.get('port'));
});

var rtc = holla.createServer(server);

function size(obj) {
   var size = 0;

   for (var key in obj) {
      if (obj.hasOwnProperty(key)){
         size++;
      }
   }

   return size;
};

// Create temp folders to store images, database
if(!fs.existsSync(__dirname +'/temp/')) {
    fs.mkdirSync(__dirname + '/temp/', 0766, function (err) {
        if (err) console.log(err);
    });
    fs.mkdirSync(__dirname + '/temp/thumb/', 0766, function (err) {
        if (err) console.log(err);
    });
}
if(!fs.existsSync(__dirname +'/database/')) {
    fs.mkdirSync(__dirname + '/database/', 0766, function (err) {
        if (err) console.log(err);
    });
}

var names = new Array();

function fix_things(){
   //console.log(names);

   var clients = io.sockets.clients();

   //removes old clients that did not trigger disconnect
   var temp = new Array();

   for(x = 0; x < clients.length; x++){
      temp[clients[x].id] = "";
   }

   for (var key in names) {
      if (!temp.hasOwnProperty(key)){
         console.log("deleting!!!!!!!!!!!!!!!");
         console.log(names, temp);

         delete names[key];
         fix_things();
         return;
      }
   }

   //looks for pairs of people disconnected
   for (var key in names) {
      if(names[key] == ""){
         for (var key2 in names) {
            if(key2 != key && names[key2] == ""){
               console.log("found pair of people disconnected!");
               console.log(names);

               names[key] = key2;
               names[key2] = key;

               io.sockets.socket(key).emit("call", {
                  name: key2
               });

               io.sockets.socket(key).emit("ready");

               fix_things();
               return;
            }
         }
      }
   }
}

setInterval(fix_things, 500);

io.sockets.on('connection', function(socket) {
   names[socket.id] = "";

   console.log(socket.id + " connected");

   if(size(names) % 2 == 0){
      var clients = io.sockets.clients();

      names[socket.id] = clients[size(names) - 2].id;
      names[clients[size(names) - 2].id] = socket.id

      console.log(clients[size(names) - 2].id + " call " + socket.id);

      io.sockets.socket(clients[size(names) - 2].id).emit("call", {
         name: socket.id
      });
   }

   console.log("connected");
   console.log(names);

   socket.on('draw', function(data) {
      socket.broadcast.emit('draw', data);
   });

   socket.on('clear', function(data) {
      socket.broadcast.emit('clear', data);
   });

   socket.on("photo", function(data) {
      socket.broadcast.emit("photo", data);
   });

   socket.on("sync_photo", function(data) {
      socket.broadcast.emit("sync_photo", data);
   });

   socket.on("sync", function(data) {
      socket.broadcast.emit("sync", data);
   });

   socket.on("desync", function(data) {
      socket.broadcast.emit("desync", data);
   });

   socket.on("sync_photo_position", function(data) {
      io.sockets.emit('sync_photo_position', data);
   });

   socket.on("sync_photo_complete", function(data) {
      socket.broadcast.emit('sync_photo_complete', data);
   });

   socket.on("prepare_photo", function(data) {
      socket.broadcast.emit("prepare_photo", data);
   });

   socket.on("back_video", function(data) {
      socket.broadcast.emit("back_video", data);
   });

   socket.on('show_cursor', function(data) {
      socket.broadcast.emit('show_cursor', data);
   });

   socket.on('hide_cursor', function(data) {
      socket.broadcast.emit('hide_cursor', data);
   });

   socket.on('send_icon', function(data) {
      socket.broadcast.emit('send_icon', data);

       var matches = data.src.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/),
           imgBuffer = {};

       if (matches.length !== 3) {
           return new Error('Invalid img input data');
       }

       imgBuffer.type = matches[1];
       imgBuffer.data = new Buffer(matches[2], 'base64');

       fs.writeFile(__dirname +'/temp/'+data.name, imgBuffer.data, function(err) {
           if (err) throw err;
           im.resize({
               srcPath: __dirname +'/temp/'+data.name,
               dstPath: __dirname +'/temp/thumb/'+data.name,
               width:   50
           }, function(err, stdout, stderr){
               if (err) throw err;
               console.log('resized image ');
           });
       });
   });

   socket.emit("inform_name", {
      name: socket.id
   });

   socket.on("ready", function(){
      var id = setInterval(function(){
         if(names[socket.id]){
            console.log("received ready from: " + socket.id + " sending to:" + names[socket.id]);

            io.sockets.socket(names[socket.id]).emit("ready");

            clearInterval(id);
         }
      }, 500);
   });

   socket.on("disconnect", function(){
      var clients = io.sockets.clients();

      //console.log(names);

      for(x = 0; x < clients.length; x++){
         if(names[clients[x].id] == socket.id){
            names[clients[x].id] = "";
         }
      }

      for(var key in names){
         if(key == socket.id){
            delete names[key];
         }
      }

      console.log("disconnected");
      console.log(names);
   });

    socket.on("get_thumbnails", function(){
        var p = __dirname +'/temp/thumb/';
        fs.readdir(p, function (err, files) {
            if (err) {
                throw err;
            }

            files.map(function (file) {
                return path.join(p, file);
            }).filter(function (file) {
                return fs.statSync(file).isFile();
            }).forEach(function (file) {
                console.log("%s (%s)", file, path.extname(file));
                var buffer = fs.readFileSync(file);
                socket.emit("receive_thumbnails", {
                    src: "data:image/jpeg;base64,"+ buffer .toString("base64"),
                    name: file
                });
            });
        });
    });

    socket.on("get_image", function(imgName){
        var fileName = path.join(__dirname, 'temp', path.basename(imgName));

        console.log("dirName: " + __dirname);
        console.log("imgName: " + imgName);

        var buffer = fs.readFileSync(fileName);
        socket.emit("receive_image", {
            src: "data:image/jpeg;base64,"+ buffer .toString("base64"),
            name: imgName,
            local: true
        });

        io.sockets.socket(names[socket.id]).emit("receive_image", {
            src: "data:image/jpeg;base64,"+ buffer .toString("base64"),
            name: imgName,
            local: false
        });
    });

    socket.on('move_image', function(data) {
        io.sockets.socket(names[socket.id]).emit("move_image",data);
    });

    socket.on('start_move_image', function(){
        io.sockets.socket(names[socket.id]).emit("start_move_image");
    });

    socket.on('stop_move_image', function(){
        io.sockets.socket(names[socket.id]).emit("stop_move_image");
    });

    socket.on('hide_thumbnails', function(){
        io.sockets.socket(names[socket.id]).emit("hide_thumbnails");
    });

    socket.on('end_call', function(){
        io.sockets.socket(names[socket.id]).emit("end_call");
    });

    socket.on('recall', function(){
        io.sockets.socket(names[socket.id]).emit("recall");
    });

    socket.on('ready_recall', function(){
        io.sockets.socket(names[socket.id]).emit("ready_recall");
    });

    socket.on('log', function(data) {
        if (mongoLog) {
            console.log("log data: ", data);
            var obj = JSON.parse(data);
            mongoLog.insert(obj, function (err, result) {
                if (!err)
                    console.log('log data inserted');
                else
                    console.log(err);
            });

        }
    })
});
