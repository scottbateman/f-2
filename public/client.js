var userID = location.search.split('userID=')[1];
if (userID) {
    userID = userID.split('&')[0];
}
if (!userID)
    userID = -1;

var isSimple = location.search.split('simple=')[1];
if (isSimple) {
    isSimple = isSimple.split('&')[0];
}
if (!isSimple)
    isSimple = false;

//Set what is enabled
var video_drawing = true;
var high_res_drawing = false;
var high_res = false;
var show_bitrate = false;
var show_time_size = false;
var show_flip_video = false;
var allow_desync_high_res = true;
var fix_orientation = true;
var cursor_drawing = true;
var allow_replace_video_with_pic = false;
var allow_hide_small_video = false;

//if true will refresh page in order to use the camera for high res., seems to not be needed in chrome mobile 29
var use_workaround_high_res = false;

var canvas_me;
var canvas_them;

var me;
var them;

var draw_at;

var particle = {
   size: 10,
   speed: 0.3
};

var mouseX;
var mouseY;

var mouseIsDown = false;

var trailTime = -1;
var counter = 0;

var mainInterval;
var sendImageIntervalId;
var timeout_id;

var socket;

var name;

var rtc;
var localStream;
var remoteStream;
var webrtcCall;
var user;

var stopDrawing = false;

var timestampPrev = 0;
var gesturableImg;

var sync = true;

var sendCursorToThem = true;

var lastDrawX, lastDrawY;
var mainTimeInterval = 50;
var drawPixelInterval = 5;
var drawFadeTime = 50;
var drawFadeStartTime = 1500;
var isDrawFade = false;
var isDrawing = false;
var drawFadeCounter = 0;
var isMeFading = false;
var isThemFading = false;
var isDrawingOnMe = false;
var isDrawingOnThem = false;

var cursorArray = [];
var cursorIndex = 0;
var cursorInterval = 40;
var cursorFadeTime = 50;
var cursorFadeStartTime = 100;
var cursorMax = 10;
var isCursorFade = false;
var cursorTime = 0;
var cursorRemoteTime = 0;
var isFirstCursor = false;
var isCursorTrace = true;

var isTakeVideoFrame = true;
var isDrawOnFrame = true;

var cursorData;
var cursorPoints = [];
var cursorStartPoint, cursorStartTime;
var cursorEndPoint, cursorEndTime;

var isAudioOn = false;
var frontVideoConstraint = {
    "minWidth": "720",
    "minHeight": "540",
    "maxWidth": "720",
    "maxHeight": "540"
};
var rearVideoConstraint = {
     //"minWidth": "1920"
     //"minHeight": "600"
     //"maxWidth": "800",
     //"maxHeight": "800"
    "minWidth": "720",
    "minHeight": "540",
    "maxWidth": "720",
    "maxHeight": "540"
};
var rearCamConstraint;
var frontCamConstraint = {  audio: isAudioOn,
                            "video": {
                                "mandatory": frontCamConstraint,
                                "optional": []
                            }};

function send_image(){
if(sync){
   socket.emit("sync_photo_position", {
      position_x: gesturableImg.position.x,
      position_y: gesturableImg.position.y,
      scale_x: gesturableImg.scale.x,
      scale_y: gesturableImg.scale.y
   });
}
}

// function hexToRgb(hex) {
//    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
//    var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
//
//    hex = hex.replace(shorthandRegex, function(m, r, g, b) {
//       return r + r + g + g + b + b;
//    });
//
//    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
//    return result ? {
//       r: parseInt(result[1], 16),
//       g: parseInt(result[2], 16),
//       b: parseInt(result[3], 16)
//    } : null;
// }

function fadeFrame(canvasName) {

    var targetCanvas = document.getElementById('canvas_'+canvasName);
    if ( !isShowingImg)
        $('#'+canvasName).show(); //video

    $(targetCanvas).animate({'opacity':'0'},1200,function(){
        console.log('4');
        var context2d = targetCanvas.getContext('2d');
        context2d.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
        $(targetCanvas).css('opacity', '0.3');
        isDrawFade = false;
        isDrawing = false;
        counter = 0;
        if (canvasName == 'me') {
            isMeFading = false;
            isDrawingOnMe = false;
        }
        else if (canvasName == 'them') {
            isThemFading = false;
            isDrawingOnThem = false;
        }
    });
}

function main_interval(){
mainInterval = setInterval(function(){
   if (isDrawing && !mouseIsDown) {
       counter += mainTimeInterval;
   }
   drawFadeCounter += mainTimeInterval;
   cursorTime += mainTimeInterval;
   cursorRemoteTime += mainTimeInterval;

   if (counter >= drawFadeStartTime) {
       isDrawFade = true;
       isDrawing = false;
       counter = 0;
       if (isDrawOnFrame) {
           if (isDrawFade && !mouseIsDown) {
               if (!isThemFading) {
                   fadeFrame('them');
                   isThemFading = true;
               }
               if (!isMeFading) {
                   fadeFrame('me');
                   isMeFading = true;
               }
           }
       }
   }

   if (isDrawFade && !mouseIsDown && !isDrawOnFrame) {
       if (drawFadeCounter >= drawFadeTime) {
           me.fillStyle = 'rgba(0,0,0,0.2)';
           me.fillRect(0, 0, me.canvas.width, me.canvas.height);

           if (them) {
               them.fillStyle = 'rgba(0,0,0,0.2)';
               them.fillRect(0, 0, them.canvas.width, them.canvas.height);
           }
           drawFadeCounter = 0;
       }
   }

   if(mouseIsDown && draw && !sendCursorToThem) {
      var lp = { x: particle.position.x, y: particle.position.y };

      particle.shift.x += (mouseX - particle.shift.x) * (particle.speed);
      particle.shift.y += (mouseY - particle.shift.y) * (particle.speed);

      particle.position.x = particle.shift.x + Math.cos(particle.offset.x);
      particle.position.y = particle.shift.y + Math.sin(particle.offset.y);

      if (((lp.x - lastDrawX)*(lp.x - lastDrawX) + (lp.y - lastDrawY)*(lp.y - lastDrawY)) > drawPixelInterval) {
          //draw(draw_at, lp.x, lp.y, particle.position.x, particle.position.y, particle.size, particle.fillColor);
          draw(draw_at, lastDrawX, lastDrawY, lp.x, lp.y, particle.size, particle.fillColor);

          trailTime = counter + Math.pow(10, $("#time").val());
          socket.emit('draw', {

              //'x1': lp.x / $("#canvas_" + draw_at).width(),
              //'y1': lp.y / $("#canvas_" + draw_at).height(),
              //'x2': particle.position.x / $("#canvas_" + draw_at).width(),
              //'y2': particle.position.y / $("#canvas_" + draw_at).height(),

              'x1': lastDrawX / $("#canvas_" + draw_at).width(),
              'y1': lastDrawY / $("#canvas_" + draw_at).height(),
              'x2': lp.x / $("#canvas_" + draw_at).width(),
              'y2': lp.y / $("#canvas_" + draw_at).height(),
              'size': particle.size,
              'color': particle.fillColor,
              'trailTime': Math.pow(10, $("#time").val()),
              'draw_at': isFlipVideo ? (draw_at == "me" ? "them" : "me") : draw_at
          });
          lastDrawX = lp.x;
          lastDrawY = lp.y;
          cursorPoints.push([parseInt(lp.x), parseInt(lp.y)]);
       }
   } else if (mouseIsDown && sendCursorToThem) {
        if (cursorTime > cursorInterval) {
            cursorTime = 0;
            socket.emit('show_cursor', {
                x: mouseX / $("#canvas_" + draw_at).width(),
                y: mouseY / $("#canvas_" + draw_at).height(),
                at: isFlipVideo ? draw_at : (draw_at === "me" ? "them" : "me"),
                local: false
            });

            if (!isFirstCursor) {
                showCursors({
                    x: mouseX / $("#canvas_" + draw_at).width(),
                    y: mouseY / $("#canvas_" + draw_at).height(),
                    at: isFlipVideo ? (draw_at === "me" ? "them" : "me") : draw_at,
                    local: true
                });
            }

            cursorPoints.push([parseInt(mouseX), parseInt(mouseY)]);
        }
   }

        if (cursorRemoteTime > cursorFadeStartTime)
            isCursorFade = true;
        if (cursorArray.length > 0) {
            if (cursorRemoteTime > cursorFadeTime) {
                // fade the oldest cursor
                if (isCursorFade) {
                    var cursorDiv = cursorArray.shift();
                    if (cursorDiv)
                        cursorDiv.empty();
                    var parentCanvas = cursorDiv.parent();
                    //parentCanvas.remove(cursorDiv);
                    cursorRemoteTime = 0;
                }
            }
        }
        else {
            isCursorFade = false
            isFirstCursor = false;
        }

}, mainTimeInterval);
}

function prepare_photo(){
	socket.on("sync_photo_position", function(data){
		gesturableImg.position.x = data.position_x;
		gesturableImg.position.y = data.position_y;
		gesturableImg.scale.x = data.scale_x;
		gesturableImg.scale.y = data.scale_y;

		requestAnimationFrame(gesturableImg.animate.bind(gesturableImg));
	});
	
	clearInterval(mainInterval);

	if(high_res_drawing){
		init_drawing();
	}

	$(".them").css("margin-left", "0px").css("height", "70%").css("width", "100%");

	$("#them").hide();
	$(".me").hide();

	canvas_them.width = $("#img_canvas").width();
	canvas_them.height = $("#img_canvas").height();

	$("#img_canvas").hide();
	$("#photo").hide();

	$("#back_video").show();

	if(allow_desync_high_res){
		$("#sync_video").show();
	}
}

// Dumping a stats variable as a string.
function dumpStats(obj) {
	var statsString = 'Timestamp:';

	statsString += obj.timestamp;

	if (obj.id) {
		statsString += "<br>id " + obj.id;
	}

	if (obj.type) {
		statsString += " type " + obj.type;
	}

	if (obj.names) {
		names = obj.names();

		for (var i = 0; i < names.length; ++i) {
			statsString += '<br>' + names[i] + ':' + obj.stat(names[i]);
		}
	} else {
		if (obj.stat('audioOutputLevel')) {
			statsString += "audioOutputLevel: " + obj.stat('audioOutputLevel') + "<br>";
		}
	}

	return statsString;
}

function getURLParameter(name) {
    return decodeURI(
        (RegExp(name + '=' + '(.+?)(&|$)').exec(location.search)||[,null])[1]
    );
}

function createFullStream(){
   var cb = function(err, stream) {
      localStream = stream;

      console.log("createFullStream");

      if (err) {
         throw err;
      }

      if(video_drawing){
         init_drawing();
      }

      if (!isFlipVideo) localStream.pipe($("#me"));
      else localStream.pipe($("#them"));

      if(!$("#picture").val()){
         $(".me").show();
      }

      socket.emit("ready");
   };

   holla.createStream(frontCamConstraint, cb);

    cursorData = new Image();
    cursorData.src = "/cursor.png";
}

function hideCursor() {
   console.log('hiding cursor');
   $('#cursor').hide();
   //isFirstCursor = false;
}

$(document).ready(function() {
	$("#img_canvas").hide();
	$("#drawing").hide();	
	$("#button").hide();
	$("#bitrate").hide();

	if(!show_time_size){
		$("#time_div").hide();
		$("#size_div").hide();
	}

	if(!high_res){
		$("#photo").hide();
	}

	if(!show_flip_video){
		$("#flip_video_div").hide();
	}

   if (allow_replace_video_with_pic) {
      $('button#icon').show();
   } else {
      $('button#icon').hide();
   }

   if (allow_hide_small_video) {
      $('div#show_small_video_div').show();
   } else {
      $('div#show_small_video_div').hide();
   }

    $('#canvas_me').css('z-index', parseInt($('#me').css('z-index'))+1);
	//window.location.hostname does not work with "localhost"
	socket = io.connect("http://" + window.location.hostname + ":8981");
	rtc = holla.createClient();

   rtc.on("call", function(call) {
      webrtcCall = call;

      console.log("Inbound call from ", webrtcCall);

      webrtcCall.on('error', function(err) {
         throw err;
      });

      webrtcCall.setLocalStream(localStream);
      webrtcCall.answer();
      if (remoteStream) remoteStream.stop();
      $("#fields").hide();
      $("#controls").show();
      $(".them").show();
      $("#alert").html("").hide();
      var userID = 0;
      for (var key in webrtcCall.users()) {
         webrtcCall.users()[key].ready(function(stream) {
            $(".them").show();
            remoteStream = stream;
            remoteUser[userID] = key;
            userID++;
            //displayIcons();
            reloadIcons();
            if (!isFlipVideo) remoteStream.pipe($("#them"));
            else remoteStream.pipe($("#me"));
            return remoteStream;
         });
      }
   });

	$("#sync_video").click(function(){
		if($(this).html() == "D"){
			sync = true;
			$(this).html("S");

			socket.emit("desync");

			send_image();
		}
		else{
			sync = false;

			$(this).html("D");
			socket.emit("sync");
		}
	});

	socket.on("desync", function(){
		sync = true;
		$("#sync_video").html("S");
	});

	socket.on("sync", function(){
		sync = false;
		$("#sync_video").html("D");
	});

	socket.on("inform_name", function(data){
		name = data.name;

		if(getURLParameter("highres") == "true"){
			console.log("high_res");
			use_workaround_high_res = false;

			//$("#photo").click();						

			//socket.emit("prepare_photo");

			//$("#canvas_them").show();
	
			$("#picture").click();	

			//return;
		}

		rtc.register(name, function(err) {
			console.log("register " + name);

			if(err){
				console.log("errrrrr" + err);
				throw err;
			}

			console.log("go for createFullStream");

			createFullStream();
		});

		$("#alert").html("waiting for a partner...");
	});

	socket.on("call", function(data){
		//console.log("socket call");
		$("#whoCall").val(data.name);

		//$("#alert").html("waiting for partner's camera...");
	});

	socket.on("prepare_photo", function(){
		prepare_photo();

		$("#canvas_them").css("opacity", "0.3");
		$(".them").hide();
		$("#alert").html("Waiting for partner's picture").show();

		var image = new Image();
		image.id = document.getElementById("them");

		document.getElementById('image_stream').insertBefore(image, document.getElementById('image_stream').firstChild);

		socket.on("sync_photo", function(data){
			$("#alert").hide();
			$("#canvas_them").show();
			$("#back_video").show();
			$("#img_canvas").show();

			gesturableImg = new ImgTouchCanvas({
		        canvas: document.getElementById('img_canvas'),
		        path: data.photo
		    });

			$("#them").width($("#img_canvas").attr("width"));
			$("#them").height($("#img_canvas").attr("height"));

			$("#canvas_them").width($("#img_canvas").attr("width"));
			$("#canvas_them").height($("#img_canvas").attr("height"));

			socket.emit("sync_photo_complete");
		});
	});

   socket.on("ready", function(){
      console.log("socket ready");

      var id = setInterval(function(){
         if (typeof localStream != 'undefined'){
            clearInterval(id);

            rtc.createCall(function(err, call) {
               webrtcCall = call;

               if (err) {
                  throw err;
               }

               console.log("Created call", webrtcCall);

               webrtcCall.on('error', function(err) {
                  throw err;
               });

               webrtcCall.setLocalStream(localStream);
               webrtcCall.add($("#whoCall").val());
               var userID = 0;
               for (var key in webrtcCall.users()) {
                  webrtcCall.users()[key].ready(function(stream) {
                      remoteStream = stream;
                     console.log("I CALL FIRST");
                     $(".them").show();
                     $("#alert").html("").hide();
                     remoteUser[userID] = key;
                     userID++;
                     //displayIcons();
                     reloadIcons();
                     if (!isFlipVideo) stream.pipe($("#them"));
                     else stream.pipe($("#me"));
                     return stream;
                  });
               }
            });
         }
      }, 100);
   });

	socket.on("back_video", function(){
		back_video(true);
	});

   socket.on('hide_cursor', function() {
      hideCursor();
      $(canvas_them).css('opacity', '0.3');
      $(canvas_me).css('opacity', '0.3');
   });

	$(window).bind('orientationchange', function(e){
		if($("#picture").val() || fix_orientation){
			if(window.orientation != 0){
				$("#alert").html("rotation is not supported, please return to portrait orientation").show();
				$(".video-container, #controls").hide();
			}
			else{
				$("#alert").html("").hide();
				$(".video-container, #controls").show();
			}
		}
		else{
			if(window.orientation == 0) {
				$(".them").css("margin-left", "0");
			} 
			else {
				$(".them").css("margin-left", "0");
			}
		}
	});

	$("#back_video").click(function(){
		socket.emit("back_video");

		back_video(false);
	});
    /*
	$("#size").change(function(){
		particle.size = Math.pow(5, $(this).val());
	});
	*/

	$("#time").change(function(){
		trailTime = counter + Math.pow(10, $("#time").val());
	});

	$("#remove").click(function(){
		trailTime = 0;
		mouseIsDown = false;
		clearTimeout(timeout_id);

		socket.emit('clear');
	});

   $('input#show_small_video').click(function() {
      var me = $('#me');
      var myCanvas = $('#canvas_me');
      if ($(this).is(':checked')) {
         me.show();
         myCanvas.show();
      } else {
         me.hide();
         myCanvas.hide();
      }
   });

	$("#photo").click(function(){
		if(use_workaround_high_res){
		   window.location.href = window.location.href + "?highres=true";
		}
		else{
			console.log("photo click");

			if (typeof webrtcCall != 'undefined'){
				//webrtcCall.end();
				webrtcCall.releaseLocalStream();
				//stream.getVideoTracks()[0].enabled = false;
			}

			socket.emit("prepare_photo");

			$("#canvas_them").show();
	
			$("#picture").click();

			console.log("calling connect");

			//rtc.unregister(function(data){console.log(data)});
			//socket.socket.disconnect();
		}
	});

	$("#picture").change(function(event){
		console.log("on take picture");
		prepare_photo();
	
		$("#canvas_them").hide();

		$("#alert").html("Sending picture").show();

		socket.on("sync_photo_complete", function(){
			$("#alert").html("").hide();
			$("#canvas_them").show();
		});

		$("#img_canvas").show();	

		var files = event.originalEvent.target.files;

		if (files && files.length > 0) {
			var URL = window.URL || window.webkitURL;
			var imgURL = URL.createObjectURL(files[0]);

			var reader = new FileReader();

            reader.onload = function(event){
				//socket.socket.connect();
				createFullStream();

				socket.emit("sync_photo", {
					photo: event.target.result,
					canvas_width: $("#img_canvas").width(),
					canvas_height: $("#img_canvas").height()
				});
            };

			gesturableImg = new ImgTouchCanvas({
		        canvas: document.getElementById('img_canvas'),
		        path: imgURL
		    });

			reader.readAsDataURL(files[0]);

			$("#me").width($("#img_canvas").attr("width"));
			$("#me").height($("#img_canvas").attr("height"));

			//$("#canvas_me").attr("width", $("#img_canvas").attr("width"));
			//$("#canvas_me").attr("height", $("#img_canvas").attr("height"));

			URL.revokeObjectURL(imgURL);

			mouseX = $("#drawing").width() * 0.5;
			mouseY = $("#drawing").height() * 0.5;

			particle = {
				size: Math.pow(5, $("#size").val()),
				position: { x: mouseX, y: mouseY },
				offset: { x: 0, y: 0 },
				shift: { x: mouseX, y: mouseY },
				speed: 0.3,
				fillColor: "#C816A1"
			};

			canvas_me = document.getElementById('drawing');

			if (canvas_me && canvas_me.getContext) {
				me = canvas_me.getContext('2d');
			}

			//socket.emit("sync_photo", {
			//	photo: document.getElementById("img_canvas").toDataURL('image/jpeg', 0.3)
			//});
		}
	});

   $('input#icon').change(function(ev) {
      var files = ev.originalEvent.target.files;
      if (files && files.length) {

         if (webrtcCall){
             webrtcCall.releaseLocalStream();
         }

         //$('.icon#take_video').show();
         //$('.icon#take_photo').hide();
         //$('.icon#switch_cam').hide();
         //$('.icon#thumbnail').hide();
         //isTakingPhoto = true;
         isPhotoSender = true;
         /*
         var reader = new FileReader();
         reader.file = files[0];
         reader.onload = function(ev) {
            var file = this.file;
            console.log(file);
            var img = new Image();
            img.src = ev.target.result;
            socket.emit('send_icon', {
               src: img.src,
               name: file.name
            });

            displayPicture($("#flip_video").is(':checked') ? "them" : "me", img.src);
         }
         reader.readAsDataURL(files[0]);
         */

          for (var i = 0; i < files.length; i++)
          {
              (function(file) {
                  var reader = new FileReader();
                  reader.file = file;
                  reader.onload = function(ev) {
                      var file = this.file;
                      console.log(file);
                      var img = new Image();
                      img.src = ev.target.result;
                      socket.emit('send_icon', {
                          src: img.src,
                          name: file.name
                      });

                      displayPicture(isFlipVideo ? "them" : "me", img.src);
                  };
                  reader.readAsDataURL(files[i]);
              })(files[i]);
          }
          //$('input#icon').attr('value','')
      }
   });

   socket.on('send_icon', function(data) {
      $('.icon#switch_cam').hide();
      $('.icon#thumbnail').hide();
      $('#them').hide();
      isPhotoSender = false;
      displayPicture(isFlipVideo ? "me" : "them", data.src);
      dbLog(EventType.receiveImage, userID, {name: data.name})
   });
	$(window).resize(function() {
		setSize = true;
	});

	$("video").resize(resizeCanvas);

	$("#canvas_me, #canvas_them").bind("touchmove mousemove", function(e){
		if(!stopDrawing){
			if(e.originalEvent.touches){
				mouseX = e.originalEvent.touches[0].pageX - $(this).offset().left;
				mouseY = e.originalEvent.touches[0].pageY - $(this).offset().top;

				e.stopPropagation(); 
				e.preventDefault();
			}
			else{
				mouseX = e.clientX - $(this).offset().left;
				mouseY = e.clientY - $(this).offset().top;
			}

			draw_at = $(this).attr("class");

			if(draw_at == "high_res"){
				draw_at = "them";
			}

            isDrawFade = false;
		}
	});

	$("#canvas_me, #canvas_them").bind("touchstart mousedown", function(e){
        console.log("down");
        if(!stopDrawing) {
            if (e.originalEvent.touches) {
                mouseX = e.originalEvent.touches[0].pageX - $(this).offset().left;
                mouseY = e.originalEvent.touches[0].pageY - $(this).offset().top;

                e.stopPropagation();
                e.preventDefault();
            }
            else {
                mouseX = e.pageX - $(this).offset().left;
                mouseY = e.pageY - $(this).offset().top;
            }

            cursorPoints = [];
            if (sendCursorToThem) {
                dbLog(EventType.startCursor, userID, {x: mouseX, y: mouseY});
                isDrawing = false;
            }
            else {
                dbLog(EventType.startDraw, userID, {color: particle.fillColor,
                    x: mouseX,
                    y: mouseY});
                isDrawing = true;
            }
            cursorStartPoint = [parseInt(mouseX), parseInt(mouseY)];
            cursorStartTime = new Date().toISOString();

            draw_at = $(this).attr("class");

            if (draw_at == "high_res") {
                draw_at = "them";
            }

            particle.shift.x += (mouseX - particle.shift.x);
            particle.shift.y += (mouseY - particle.shift.y);

            lastDrawX = particle.position.x = particle.shift.x + Math.cos(particle.offset.x);
            lastDrawY = particle.position.y = particle.shift.y + Math.sin(particle.offset.y);

            mouseIsDown = true;
            isDrawFade = false;
            socket.emit('mousedown', {
                'x': particle.position.x,
                'y': particle.position.y,
                'mouseIsDown': mouseIsDown,
                'draw_at': isFlipVideo ? (draw_at == "me" ? "them" : "me") : draw_at,
                'isDrawing': isDrawing
            });

            if (isDrawOnFrame && !sendCursorToThem && !isShowingImg) {
                var targetName = draw_at;
                var targetCanvas = document.getElementById('canvas_' + targetName);
                $(targetCanvas).css('opacity', '1');
                $('#' + targetName).hide();
                //$('#' + targetName).get(0).pause();
                var context2d = targetCanvas.getContext('2d');
                //context2d.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
                if (!(isDrawingOnMe && (targetName == 'me') || isDrawingOnThem && (targetName == 'them')))
                    context2d.drawImage(document.querySelector('#' + targetName), 0, 0, targetCanvas.width, targetCanvas.height);
                else {
                    if ( isMeFading || isThemFading) {
                        $(canvas_them).stop();
                        $(canvas_me).stop();
                        $(canvas_them).css('opacity', '1');
                        $(canvas_me).css('opacity', '1');
                        isDrawing = true;
                        isDrawFade = false;
                        counter = 0;
                        isMeFading = false;
                        isDrawingOnMe = true;
                        isThemFading = false;
                        isDrawingOnThem = true;
                    }
                }
                if (targetName == 'me') isDrawingOnMe = true;
                if (targetName == 'them') isDrawingOnThem = true;
            }
        }
	});
	
   $("#canvas_me, #canvas_them").bind("touchend mouseup", function(ev){
       console.log("up");
      mouseIsDown = false;
      isDrawFade = false;
      counter = 0;
      if (sendCursorToThem) {
         socket.emit('hide_cursor');
         dbLog(EventType.stopCursor, userID, {x: mouseX, y:mouseY});
      }
      else
         dbLog(EventType.stopDraw, userID, {color: particle.fillColor,
                                            x: mouseX,
                                            y: mouseY});

      cursorEndPoint = [parseInt(mouseX), parseInt(mouseY)];
      cursorEndTime = new Date().toISOString();
      var dragType = sendCursorToThem?"cursor":"draw";
      dbLog(EventType.fingerDrag, userID, {
                                            type: dragType,
                                            startTime: cursorStartTime,
                                            endTime: cursorEndTime,
                                            startPoint: cursorStartPoint,
                                            endPoint: cursorEndPoint,
                                            points: cursorPoints
                                          })

   });

	$("#img_canvas").bind("touchend mouseup", function(){
		send_image();
	});

	socket.on('draw', function(data) {
		var flip;
      var checked = isFlipVideo;
      if ((data.draw_at === 'me' && !checked) || (data.draw_at === 'them' && checked)) {
         flip = 'them';
      } else {
         flip = 'me';
      }
		draw(flip, 
			$("#canvas_" + flip).width() * data.x1, 
			$("#canvas_" + flip).height() * data.y1, 
			$("#canvas_" + flip).width() * data.x2, 
			$("#canvas_" + flip).height() * data.y2, 
			data.size, 
			data.color);
		//trailTime = counter + data.trailTime;
        counter = 0;
        isDrawFade = false;
	});

   socket.on('show_cursor', function(data) {
      if (!(mouseIsDown&&sendCursorToThem))
          showCursors(data);
   });

	socket.on("clear", function(){
		trailTime = 0;
		mouseIsDown = false;

		clearTimeout(timeout_id);
	});

	document.onselectstart = function() { return false; }

	// Display statistics
	if(show_bitrate){
		$("#bitrate").show();

		setInterval(function() {
			function display(str) {
				$('#bitrate').html("Bitrate: " + str);
			}

			if (typeof webrtcCall != 'undefined'){
				for (var key in webrtcCall.users()) {
					webrtcCall.user(key).connection.getStats(function(stats) {
						var statsString = '';
						var results = stats.result();
						var bitrateText;// = 'No bitrate stats';

						for (var i = 0; i < results.length; ++i) {
							var res = results[i];
							statsString += '<h3>Report ' + i + '</h3>';

							if (!res.local || res.local === res) {
								statsString += dumpStats(res);

								if (res.type == 'ssrc' && res.stat('googFrameHeightReceived')) {
									var bytesNow = res.stat('bytesReceived');

									if (timestampPrev > 0) {
										var bitRate = Math.round((bytesNow - bytesPrev) * 8 / (res.timestamp - timestampPrev));
										bitrateText = bitRate + ' kbits/sec';
									}

									timestampPrev = res.timestamp;
									bytesPrev = bytesNow;
								}
							} else {
								// Pre-227.0.1445 (188719) browser
								if (res.local) {
									statsString += "<p>Local " + dumpStats(res.local);
								}

								if (res.remote) {
									statsString += "<p>Remote " + dumpStats(res.remote);
								}
							}
						}

						$('receiverstats').innerHTML = statsString;

						display(bitrateText);
					});
				}
			}
			else{
				display("No stream");
			}
		}, 1000);
	}

   $('#show_line').click(function(ev) {
      sendCursorToThem = !$(this).is(':checked');
   });

    socket.on('receive_thumbnails', receiveThumbnails);
    socket.on('receive_image', receiveImage);
    socket.on('move_image', moveImage);

    socket.on('start_move_image', function(){
        isMovingImg = true;
        $(wrap_them).css("z-index", "3");
        $(wrap_me).css("z-index", $('#canvas_me').css('z-index'));

        $('.icon#hand').css('border-color', 'red');
        $('.icon#arrow').css('border-color', 'transparent');
        $('.icon#pen').css('border-color', 'transparent');
    });
    socket.on('stop_move_image', function() {
        $(wrap_them).css("z-index", "1");
        $(wrap_me).css("z-index", "1");
        isMovingImg = false;

        if (!sendCursorToThem) {
            $('.icon#pen').css('border-color', 'red');
            $('.icon#arrow').css('border-color', 'transparent');
            $('.picker').show(animSpeed);
        }
        else {
            $('.icon#arrow').css('border-color', 'red');
            $('.icon#pen').css('border-color', 'transparent');
            $('.picker').hide(animSpeed, 'easeOutBounce');
        }
        $('.icon#hand').css('border-color', 'transparent');
    });

    socket.on('hide_thumbnails', function() {
        removeImg();
    });


    socket.on('end_call', endCall);
    socket.on('recall', function(){
        createNewStream()
    });
    socket.on('ready_recall', function(){
        callAgain(videoSource)
    });

    socket.on('prepare_switch_cam', function(){
        endCall();
        createNewStream();
    });

    socket.on('mousedown', function(data) {
        isDrawFade = false;
        counter = 0;
        isDrawing = data.isDrawing;
        if (isDrawOnFrame && isDrawing && !isShowingImg) {
            var targetDraw = '';
            if (data.draw_at == 'them')
                targetDraw = isFlipVideo?'them':'me';
            else if (data.draw_at == 'me')
                targetDraw = isFlipVideo?'me':'them';
            var targetCanvas = document.getElementById('canvas_'+targetDraw);
            $(targetCanvas).css('opacity', '1');
            $('#'+targetDraw).hide();
            //$('#'+targetDraw).get(0).pause();
            var context2d = targetCanvas.getContext('2d');
            if (!(isDrawingOnMe && (targetDraw == 'me') || isDrawingOnThem && (targetDraw == 'them')))
                context2d.drawImage(document.querySelector('#' + targetDraw), 0, 0, targetCanvas.width, targetCanvas.height);
            else {
                if (isMeFading || isThemFading) {
                    $(canvas_me).stop();
                    $(canvas_them).stop();
                    $(canvas_me).css('opacity', '1');
                    $(canvas_them).css('opacity', '1');
                    isDrawing = true;
                    isDrawFade = false;
                    counter = 0;
                    isMeFading = false;
                    isDrawingOnMe = true;
                    isThemFading = false;
                    isDrawingOnThem = true;
                }
            }
            if (targetDraw == 'me') isDrawingOnMe = true;
            if (targetDraw == 'them') isDrawingOnThem = true;
        }
    })
});

function init_drawing() {
	mouseX = $("#me").width() * 0.5;
	mouseY = $("#me").height() * 0.5;

	canvas_me = document.getElementById('canvas_me');
	canvas_them = document.getElementById('canvas_them');
    wrap_me = document.getElementById('wrap_me');
    wrap_them = document.getElementById('wrap_them');

    $(canvas_them).css('opacity', '0.18');
    $(canvas_me).css('opacity', '0.18');

    if (canvas_me && canvas_me.getContext) {
		me = canvas_me.getContext('2d');
		them = canvas_them.getContext('2d');

		particle = {
			size: particle.size,
			position: { x: mouseX, y: mouseY },
			offset: { x: 0, y: 0 },
			shift: { x: mouseX, y: mouseY },
			speed: particle.speed,
			fillColor: "#ee82ee"
		};

		main_interval();
	}
}

function draw(at, x1, y1, x2, y2, size, color){
	if(!stopDrawing){
		if(window[at]){
			window[at].beginPath();
			window[at].fillStyle = color;
			window[at].strokeStyle = color;
			window[at].lineWidth = size;
			window[at].moveTo(x1, y1);
			window[at].lineTo(x2, y2);
			window[at].stroke();
			window[at].arc(x2, y2, size / 2, 0, Math.PI * 2, true);
			window[at].fill();
		}
	}
}

function moveCursor(at, x, y) {
   $('#cursor')
      .css('left', $('#canvas_' + at).offset().left + x)
      .css('top', $('#canvas_' + at).offset().top + y);
   //console.log(x,y);
}

function resizeCanvas(){
   if(canvas_me){
      canvas_me.width = $("#me").width();
      canvas_me.height = $("#me").height();

      $(wrap_me).css('width', canvas_me.width +'px');
      $(wrap_me).css('height', canvas_me.height +'px');
   }
   if(canvas_them){
      canvas_them.width = $("#them").width();
      canvas_them.height = $("#them").height();

      $(wrap_them).css('width', canvas_them.width +'px');
      $(wrap_them).css('height', canvas_them.height +'px');
   }
}

function back_video(isReceiver){
    // Delete img and hide div
    $(wrap_me).css("z-index","1").empty().show();
    $(wrap_them).css("z-index","1").empty().show();
    // Enable video stream, show video
    //localStream.getVideoTracks()[0].enabled = true;
    $('video#me').show();
    $('video#them').show();
    isTakingPhoto = false;
    isShowingImg = false;
    isPhotoSender = false;
    displayIcons();
    resizeCanvas();
    if (!isReceiver)
        callAgain(videoSource);
}

function displayPicture(at, src) {
    var canvas,wrap;
    if (at === 'me') {
        canvas = document.getElementById('canvas_me');
        canvas_me = canvas;
        wrap = document.getElementById('wrap_me');
    } else if (at === 'them') {
        canvas = document.getElementById('canvas_them');
        canvas_them = canvas;
        wrap = document.getElementById('wrap_them');
    }
    $(wrap).empty();
    var video = $('video#' + at);
    var img = $('<img>', {
        id: video.attr('id'),
        //class: video.attr('class'),
        src: src
    }).appendTo($(wrap)).show();
    currentImg = img;
    $(wrap_me).css("z-index",$('#canvas_me').css('z-index')).show();
    $(wrap_them).css("z-index","3").show();

    img.css("position", "relative");
    img.css("top", "0px");
    img.css("left", "0px");

    originRatio = undefined;
    resizeImg(wrap,img);

    imgWidth = img.width();
    imgHeight = img.height();

    Hammer(img.get(0), {
        drag_block_horizontal: true,
        drag_block_vertical: true,
        drag_min_distance: 0,
        drag_max_touches: 2
    }).on("touch drag pinch release", gestureHandler);

    isShowingImg = true;
    isMovingImg = true;
    //video.hide();
    displayIcons();
}

///////////////////////////////////////////////////////
// For photo's gestures
var min   = 0.5,
    max   = 3,
    imgWidth,
    imgHeight,
    scale = 1,
    lastX = 0,
    lastY = 0;
var currentImg,wrap_me,wrap_them, originW, originH,lastScrollY, originRatio;

Hammer.plugins.fakeMultitouch();
Hammer.plugins.showTouches();

function gestureHandler(event) {
    if (!isMovingImg) return;
    if(Hammer.utils.isVertical(event.gesture.direction)) {
        //return;
    }
    var targetImg = event.target;
    var wrap = $(targetImg).parent();
    event.preventDefault();
    switch(event.type) {
        case 'touch':
            lastX = $(targetImg).offset().left - wrap.offset().left;
            lastY = $(targetImg).offset().top - wrap.offset().top;
            break;

        case 'drag':
            var deltaX = event.gesture.deltaX ;
            var deltaY = event.gesture.deltaY ;
            $(targetImg).css("top", lastY + deltaY);
            $(targetImg).css("left", lastX + deltaX);

            socket.emit('move_image', {
                top: parseInt($(targetImg).css( 'top' )) / parseInt(wrap.css( 'height' )) ,
                left: parseInt($(targetImg).css('left')) / parseInt(wrap.css( 'width' )) ,
                width: parseInt($(targetImg).css( 'width' )) / parseInt(wrap.css( 'width' )) ,
                ratio: parseInt($(targetImg).css( 'width' )) / parseInt($(targetImg).css( 'height' ))
            });

            break;

        case 'release':
            checkImgBoundary(targetImg, wrap);
            /*
            imgWidth = parseInt( $(targetImg).css( 'width' ) );
            imgHeight = parseInt( $(targetImg).css( 'height' ) );

            var divWidth = parseInt(wrap.css( 'width' ));
            var divHeight = parseInt(wrap.css( 'height' ));
            var divX = parseInt(wrap.offset().left);
            var divY = parseInt(wrap.offset().top);
            var imgX = $(targetImg).offset().left - divX;
            var imgY = $(targetImg).offset().top - divY;

            if (imgWidth >= divWidth){
                if (imgX < divWidth-imgWidth)
                    imgX = divWidth-imgWidth;
                else if (imgX > 0)
                    imgX = 0;
            }
            if (imgHeight >= divHeight){
                if (imgY > 0)
                    imgY = 0;
                else if (imgY < divHeight - imgHeight)
                    imgY = divHeight-imgHeight;
            }
            if (imgWidth < divWidth && imgHeight < divHeight)
            {
                if (imgX < 0)
                    imgX = 0;
                else if (imgX > divWidth - imgWidth)
                    imgX = divWidth - imgWidth;
                if (imgY < 0)
                    imgY = 0;
                else if (imgY > divHeight - imgHeight)
                    imgY = divHeight - imgHeight;
            }

            $(targetImg).css("left", imgX );
            $(targetImg).css("top", imgY);
            */
            socket.emit('move_image', {
                top: parseInt($(targetImg).css( 'top' )) / parseInt(wrap.css( 'height' )) ,
                left: parseInt($(targetImg).css( 'left' )) / parseInt(wrap.css( 'width' )),
                width: parseInt($(targetImg).css( 'width' )) / parseInt(wrap.css( 'width' )) ,
                ratio: parseInt($(targetImg).css( 'width' )) / parseInt($(targetImg).css( 'height' ))
                //imgScale: imgWidth / originW
            });
            break;

        case 'pinch':
            scale = event.gesture.scale;

            if ( scale > max ) scale = max;
            if ( scale < min ) scale = min;

            targetImg.style.width = scale*imgWidth + 'px';
            //if (parseInt($(targetImg).css("max-width")) <= 40)
            targetImg.style.height = scale*imgHeight + 'px';

            socket.emit('move_image', {
                imgScale:   parseInt( $(targetImg).css( 'width' ) ) / originW
            });

            break;
    }
}

function moveImage(data) {
    if (currentImg) {
        if (data.top) {
            currentImg.css('top', data.top * $(wrap_them).height() + 'px');
            currentImg.css('left', data.left * $(wrap_them).width()+ 'px');
            currentImg.css('width', data.width * $(wrap_them).width()+ 'px');
            currentImg.css('height', parseInt(currentImg.css('width'))/data.ratio+ 'px');
        }
        if (data.imgScale) {
            currentImg.css('width', data.imgScale * originW + 'px');
            currentImg.css('height', data.imgScale * originH + 'px');
        }
        checkImgBoundary(currentImg, currentImg.parent());
    }
}

function checkImgBoundary(targetImg, wrap) {
    imgWidth = parseInt( $(targetImg).css( 'width' ) );
    imgHeight = parseInt( $(targetImg).css( 'height' ) );

    var divWidth = parseInt(wrap.css( 'width' ));
    var divHeight = parseInt(wrap.css( 'height' ));
    var divX = parseInt(wrap.offset().left);
    var divY = parseInt(wrap.offset().top);
    var imgX = $(targetImg).offset().left - divX;
    var imgY = $(targetImg).offset().top - divY;

    if (imgWidth >= divWidth){
        if (imgX < divWidth-imgWidth)
            imgX = divWidth-imgWidth;
        else if (imgX > 0)
            imgX = 0;
    }
    if (imgHeight >= divHeight){
        if (imgY > 0)
            imgY = 0;
        else if (imgY < divHeight - imgHeight)
            imgY = divHeight-imgHeight;
    }
    if (imgWidth < divWidth && imgHeight < divHeight)
    {
        if (imgX < 0)
            imgX = 0;
        else if (imgX > divWidth - imgWidth)
            imgX = divWidth - imgWidth;
        if (imgY < 0)
            imgY = 0;
        else if (imgY > divHeight - imgHeight)
            imgY = divHeight - imgHeight;
    }

    $(targetImg).css("left", imgX );
    $(targetImg).css("top", imgY);
}
$('#wrap_scroll').css('max-height', '500%');
$('#wrap_thumb').css('height', '0%');
Hammer($('#wrap_thumb').get(0), {
    drag_block_horizontal: true,
    drag_block_vertical: true,
    drag_min_distance: 0,
    drag_max_touches: 2
}).on("swipedown swipeup touch drag", function(e){
    e.preventDefault();
    $('#wrap_scroll').children().stop();
    $('#wrap_thumb').css('width',$('#wrap_scroll').css('width'));
    switch(e.type) {
        case 'touch':
            lastScrollY = parseInt($('#wrap_scroll').css('top'));
            break;

        case 'drag':
            var deltaY = event.gesture.deltaY ;
            $('#wrap_scroll').css("top", lastScrollY +deltaY +'px');
            break;
    }
});
////////////////////////////////////////////////////////////////
// Switch cameras
var remoteUser = new Array();
var sourceIDs = new Array();
var videoSource = 0;
var camera1 = true;
var videoSelect = document.querySelector("select#videoSource");

MediaStreamTrack.getSources(gotSources);

function gotSources(sourceInfos) {
    var storageIndex = 0;
    for (var i = 0; i != sourceInfos.length; ++i) {
        var sourceInfo = sourceInfos[i];
        var option = document.createElement("option");
        option.value = sourceInfo.id;
        if (sourceInfo.kind === 'video') {
            option.text = sourceInfo.label || 'camera ' + (videoSelect.length + 1);
            videoSelect.appendChild(option);
            sourceIDs[storageIndex] = sourceInfos[i].id;
            storageIndex++;
        }
        rearCamConstraint = {   audio: isAudioOn,
                                "video": {
                                    "mandatory": rearVideoConstraint,
                                    "optional": [{sourceId: sourceIDs[1]}]
                            }};

        frontCamConstraint = {  audio: isAudioOn,
                                "video": {
                                    "mandatory": frontVideoConstraint,
                                    "optional": [{sourceId: sourceIDs[0]}]
                             }};
    }
}

videoSelect.onchange = function() {
    camera1 = !camera1;
    if (camera1)
        videoSource = 0;
    else
        videoSource = 1;

    callAgain(videoSource)
};

var callAgain = function (sourceID){
    if (localStream) localStream.stop();
    if (remoteStream) remoteStream.stop();

    var constrain = videoSource == 0?frontCamConstraint:rearCamConstraint;
    /*
    var constrain = {   audio: isAudioOn,
        "video": {
            "mandatory": {
                "minWidth": "720",
                "minHeight": "540",
                "maxWidth": "720",
                "maxHeight": "540"
            },
            "optional": [
                {sourceId: sourceIDs[sourceID]}
            ]
        }};
    */

    holla.createStream(constrain, function(error, stream){
        if (error) {
            alert(error);
            throw error;
        }
        localStream = stream;
        if (!isFlipVideo) stream.pipe($('#me'));
        else stream.pipe($('#them'));

        rtc.createCall(function(err, call) {
            webrtcCall = call;

            if (err) {
                throw err;
            }

            console.log("Created call again", webrtcCall);
            reloadIcons();
            webrtcCall.on('error', function(err) {
                throw err;
            });

            webrtcCall.setLocalStream(localStream);
            //webrtcCall.add($("#whoCall").val());
            webrtcCall.add(remoteUser[0]);

            var userID = 0;
            for (var key in webrtcCall.users()) {
                webrtcCall.users()[key].ready(function(stream) {
                    remoteStream = stream;
                    console.log("successfully");
                    $(".them").show();
                    $("#alert").html("").hide();
                    remoteUser[userID] = key;
                    userID++;
                    displayIcons();
                    if (!isFlipVideo) stream.pipe($("#them"));
                    else stream.pipe($("#me"));
                    return stream;
                });
            }
            //isFlipVideo = false;
        });
    });
};

/////////////////////////////////////////////////////
// Image thumbnails
var isMovingImg = true;
var isShowingImg = false;
var isPhotoSender = false;
$('.icon#thumbnail').click(function() {
    $('.icon#thumbnail').animate({height:"40px",width:'40px'},100, function(){
        $('.icon#thumbnail').animate({height:"35px",width:'35px'},100);
    });
    isShowingThumbnail = !isShowingThumbnail;
    if (isShowingThumbnail) {
        var wrap = document.getElementById('wrap_scroll');
        $(wrap).css('top', '10%').empty();
        socket.emit('get_thumbnails');
        $('#wrap_thumb').animate({'height':"60%"},500);
        //$('.icon#take_photo').hide(animSpeed);
        $('.icon#switch_cam').hide(animSpeed);
        $('.icon#thumbnail').attr('src', 'image/take_video.png');
        dbLog(EventType.showThumbnails, userID);
    }
    else {
        $('#wrap_thumb').animate({'height':"0%"},500, function(){
            $('#wrap_scroll').empty();

            socket.emit('hide_thumbnails');
            $('.icon#take_photo').show(animSpeed);
            $('.icon#switch_cam').show(animSpeed);

            removeImg();
            dbLog(EventType.hideThumbnails, userID);
            $('.icon#thumbnail').attr('src', 'image/thumbnail.png');
            if (isTakingPhoto) {
                socket.emit("back_video");
                back_video(false);
                dbLog(EventType.backToVideo, userID);
            }
        })
    }
});

function removeImg() {
    $('#wrap_me').empty();
    $('#wrap_them').empty();
    $('#them').show();
    $('#me').show();
    isShowingImg = false;
    isPhotoSender = false;
    stopMovingImg();
    $('.icon#hand').css('opacity', '0.15');
    if (!sendCursorToThem) {
        $('.icon#pen').css('border-color', 'red');
        $('.icon#arrow').css('border-color', 'transparent');
    }
    else {
        $('.icon#pen').css('border-color', 'transparent');
        $('.icon#arrow').css('border-color', 'red');
        $('.picker').hide();
    }
}

function receiveThumbnails(data){
    var wrap = document.getElementById('wrap_scroll');

    var img = $('<img>', {
        id: data.name,
        src: data.src
    }).appendTo($(wrap)).show();

    img.css("position", "relative");
    img.css("top", "0px");
    img.css("left", "0px");

    var imgName = data.name;

    img.on('click', function(ev){
        var y = ev.pageY;
        var height = $(document).height() * 0.7;
        if (y < height) {
            socket.emit('get_image', imgName);
            $('#loading').css('top', $(document).height() / 2).css('left', $(document).width() / 2).show();
            dbLog(EventType.selectThumbnail, userID, {name: imgName})
        }
    });
}

function receiveImage(data){
    if (data.local) {
        isPhotoSender = true;
        displayPicture(isFlipVideo ? "them" : "me", data.src);
    }
    else {
        isPhotoSender = false;
        displayPicture(isFlipVideo ? "me" : "them", data.src);
        originW = parseInt( currentImg.css( 'width' ) );
        originH = parseInt( currentImg.css( 'height' ) );
        dbLog(EventType.receiveImage, userID, {name: data.name})
    }
    $('#loading').hide();
}

function resizeImg(wrapDiv,img)
{
    var ratio;
    if (!originRatio) {
        ratio = parseInt(img.css("width")) / parseInt(img.css("height"));
        originRatio = ratio;
    }
    else
        ratio = originRatio;
    if (ratio > 1)
    {
        img.css("width", ($(wrapDiv).width())+"px");
        img.css("height", (parseInt(img.css("width"))/ratio)+"px");
    }
    else
    {
        img.css("height", ($(wrapDiv).height())+'px');
        img.css("width", (ratio*parseInt(img.css("height")))+"px");
    }
    img.css('top', '0px');
    img.css('left', $(wrapDiv).width()/2 - $(img).width()/2 + 'px');
    //img.css('left','0px');
}

//////////////////////////////
// Icons
var animSpeed = 300;
var isShowSmallVideo = true;
var videoMeWidth,videoMeHeight;
var isFlipVideo = false;
var isTakingPhoto = false;
var isShowingThumbnail = false;
var isCalling = true;

$('.icon#hide_video').click(function(){
    $('.icon#hide_video').animate({height:"35px",width:'35'},100, function(){
        $('.icon#hide_video').animate({height:"30px",width:'30'},100);
    });
    showSmallVideo();
    //displayIcons();
});

function showSmallVideo() {
    var me = $('#me');
    var myCanvas = $('#canvas_me');
    var iHideVideo = $('.icon#hide_video');
    var iSwapVideo = $('.icon#swap_video');
    if (!isShowSmallVideo) {
        myCanvas.show(animSpeed*0.5);
        me.show(animSpeed, function() {
            if (!isSimple) $('.icon#switch_cam').show();
            if (isShowingImg) {
                if($('#wrap_me').children().length > 0) {
                    currentImg.show();
                }
            }
        });
        iHideVideo.animate({
            right:(videoMeWidth - parseInt(iHideVideo.css('width')))+'px',
            bottom:(videoMeHeight - parseInt(iHideVideo.css('height')))+'px'
        },animSpeed*0.5);
        iSwapVideo.animate({bottom:(videoMeHeight - parseInt(iSwapVideo.css('width')))+'px'},animSpeed*0.5);
        iSwapVideo.show(animSpeed);

        isShowSmallVideo = true;
        $('.icon#hide_video').attr('src', 'image/arrow_hide.png');
        dbLog(EventType.showSmallVideo, userID);
    } else {
        if (isShowingImg) {
            if($('#wrap_me').children().length > 0) {
                currentImg.hide();
            }
        }
        myCanvas.hide();

        videoMeWidth = parseInt(me.css('width'));
        videoMeHeight = parseInt(me.css('height'));
        iHideVideo.animate({right:"0px",bottom:'0px'},animSpeed*0.5);
        iSwapVideo.animate({bottom:'0px'},animSpeed*0.5);
        iSwapVideo.hide(animSpeed);
        me.hide(animSpeed);

        isShowSmallVideo = false;
        if(!isFlipVideo) $('.icon#switch_cam').hide();
        $('.icon#hide_video').attr('src', 'image/arrow_show.png');
        dbLog(EventType.hideSmallVideo, userID);
    }
}

function displayIcons(){
    $('.icon').show();
    var iHideVideo = $('.icon#hide_video');
    var iSwapVideo = $('.icon#swap_video');
    var iSwitchCam = $('.icon#switch_cam');
    var iTakePhoto = $('.icon#take_photo');
    var iTakeVideo = $('.icon#take_video');
    var iCursor = $('.icon#arrow');
    var iPen = $('.icon#pen');
    var iPalette = $('.icon#palette');
    var iEraser = $('.icon#eraser');
    var iThumbnail = $('.icon#thumbnail');
    var iHand = $('.icon#hand');
    var iHangUp = $('.icon#hangup');
    var videoMe = $('#me');
    var videoThem = $('#them');

    iHideVideo.css('width', '30px').css('height', '30px');
    iHideVideo.css('right', (parseInt(videoMe.css('width')) - parseInt(iHideVideo.css('width'))) +'px');
    iHideVideo.css('bottom', (parseInt(videoMe.css('height')) - parseInt(iHideVideo.css('height'))) +'px');

    iSwapVideo.css('width', '30px').css('height', '30px');
    iSwapVideo.css('right', '0px');
    iSwapVideo.css('bottom', (parseInt(videoMe.css('height')) - parseInt(iSwapVideo.css('height')))+'px');

    iThumbnail.css('top', '2%').css('right', '2%').css('width','35px').css('height', '35px');
    iSwitchCam.css('width','35px').css('height', '35px');
    iTakePhoto.css('top', '2%').css('right', '20%').css('width','35px').css('height', '35px');
    iTakeVideo.css('top', '2%').css('right', '20%').css('width','35px').css('height', '35px').hide();
    /*
    if (isTakingPhoto) {
        iTakePhoto.hide();
        iThumbnail.hide();
    }
    else
        iTakeVideo.hide();
    */
    iCursor.css('bottom', '22%').css('left', '5%').css('width','30px').css('height', '30px').css('border-style', 'solid');
    iPen.css('bottom', '12%').css('left', '5%').css('width','30px').css('height', '30px').css('border-style', 'solid');
    iPalette.css('bottom', '2%').css('left', '5%').css('width','30px').css('height', '30px').hide();
    $('.picker').css('bottom', '2%').css('left', '5%').css('width','30px').css('height', '30px').show();
    iEraser.css('bottom', '2%').css('left', '5%').css('width','30px').css('height', '30px').hide();

    iHand.css('bottom', '32%').css('left', '5%').css('width','30px').css('height', '30px').css('border', 'solid');

    if (!isShowingImg){
        if (!sendCursorToThem)
            iPen.css('border-color', 'red');
        else {
            iCursor.css('border-color', 'red');
            $('.picker').hide();
        }
        iHand.css('opacity', '0.15').css('border-color', 'transparent');
    }
    else {
        if (isMovingImg) {
            $('.icon#hand').css('border-color', 'red');
            $('.icon#arrow').css('border-color', 'transparent');
            $('.icon#pen').css('border-color', 'transparent');
        }
        else {
            if (!sendCursorToThem) {
                $('.icon#pen').css('border-color', 'red');
                $('.icon#arrow').css('border-color', 'transparent');
                $('.picker').show();
            }
            else {
                $('.icon#arrow').css('border-color', 'red');
                $('.icon#pen').css('border-color', 'transparent');
                $('.picker').hide();
            }
            $('.icon#hand').css('border-color', 'transparent');
        }
        iHand.css('opacity', '1');

        iSwitchCam.hide();
        if (!isFlipVideo) {
            isPhotoSender? $('#me').hide(): $('#them').hide();
        }
        else {
            isPhotoSender? $('#them').hide(): $('#me').hide();
        }
    }

    if (isFlipVideo) {
        iSwitchCam.css('left', (parseInt(videoThem.css('width'))/2)/2 +'px');
        iSwitchCam.css('top', '2%');
    }
    else {
        iSwitchCam.css('left','auto').css('right', (parseInt(videoMe.css('width'))/2 - parseInt(iSwitchCam.css('width'))/2) +'px');
        iSwitchCam.css('top', 'auto').css('bottom', (parseInt(videoMe.css('height')) - parseInt(iSwitchCam.css('height'))) +'px');
    }

    if (isShowingThumbnail) {
        //$('.icon#take_photo').hide();
        $('.icon#switch_cam').hide();
    }

    iHangUp.css('bottom', '2%').css('left', '25%').css('width','35px').css('height', '35px');

    $('.icon').each(function(e) {
        var element = $('.icon')[e];
        var w = element.width;
        //$(element).css('background-size', w+'px' );
        //$(element).css('border-radius', w/2+2+'px' );
        //$(element).css('border-radius', '50%' );
    });

    // Simple version of the app
    if (isSimple) {
        $('.icon').hide();
        iSwapVideo.show();
        iHideVideo.show();
    }
}

$('.icon#swap_video').click(function(){
    isFlipVideo = !isFlipVideo;

    var me = $('#me');
    var them = $('#them');
    me.hide(currentImg && isShowingImg? 0 :animSpeed * 0.5);
    them.hide(currentImg && isShowingImg? 0 :animSpeed * 0.5);

    $('.icon').hide();
    $('#canvas_me').hide();
    $('#canvas_them').hide();

    me.attr('id', 'them').attr('class', 'them');
    if (me.prop('tagName') === 'VIDEO') { me.attr('muted', false); }
    them.attr('id', 'me').attr('class', 'me');
    if (them.prop('tagName') === 'VIDEO') { me.attr('muted', true); }

    me.show(currentImg && isShowingImg? 0 :animSpeed);
    them.show(currentImg && isShowingImg? 0:animSpeed, function(){
        $('#canvas_me').show();
        $('#canvas_them').show();
        resizeCanvas();

        if (currentImg && isShowingImg){
            var parentDiv = $(currentImg).parent();
            if (parentDiv.attr('class') == 'me') {
                $(currentImg).appendTo($(wrap_them));
                resizeImg(wrap_them, currentImg);
            }
            else {
                $(currentImg).appendTo($(wrap_me));
                resizeImg(wrap_me, currentImg);
            }
            originW = parseInt( currentImg.css( 'width' ) );
            originH = parseInt( currentImg.css( 'height' ) );
        }

        displayIcons();
        dbLog(EventType.swapVideos, userID);
    });
});

$('.icon#switch_cam').click(function(){
    $('.icon#switch_cam').animate({height:"40px",width:'40px'},100, function(){
        $('.icon#switch_cam').animate({height:"35px",width:'35px'},100);
    });
    camera1 = !camera1;
    if (camera1)
        videoSource = 0;
    else
        videoSource = 1;

    endCall();
    socket.emit('prepare_switch_cam');

    dbLog(EventType.switchCameras, userID);
    //callAgain(videoSource);
});

$('.icon#take_photo').click(function(){
    $('.icon#take_photo').animate({height:"40px",width:'40px'},100, function(){
        $('.icon#take_photo').animate({height:"35px",width:'35px'},100);
    });

    if (!isTakeVideoFrame) {
        if (localStream) localStream.stop();
        $('input#icon').click();
        isTakingPhoto = true;
    }
    else {
        isPhotoSender = true;
        var context2d = canvas_them.getContext('2d');
        context2d.drawImage(document.querySelector('#them'), 0, 0, canvas_them.width, canvas_them.height);
        var imgData = canvas_them.toDataURL("image/jpeg");
        if (!isFlipVideo) swapVideos();
        socket.emit('send_icon', {
            src: imgData,
            name: new Date().getTime()+'.jpg'
        });

        displayPicture(isFlipVideo ? "them" : "me", imgData);
        // Flashing effect
        currentImg.animate({opacity:"0"},100, function() {
            currentImg.animate({opacity:"100"},100, function() {
                currentImg.animate({opacity:"0"},300, function() {
                    currentImg.animate({opacity:"100"},300);
                });
            });
        });
        canvas_them.getContext('2d').clearRect ( 0 , 0 ,  canvas_them.width, canvas_them.height);
    }

    // Show thumbnail list
    if (!isShowingThumbnail) {
        isShowingThumbnail = true;
        var wrap = document.getElementById('wrap_scroll');
        $(wrap).css('top', '10%').empty();
        socket.emit('get_thumbnails');
        $('#wrap_thumb').animate({'height':"60%"},500);
        $('.icon#switch_cam').hide(animSpeed);
        $('.icon#thumbnail').attr('src', 'image/take_video.png');
    }

    dbLog(EventType.takePhoto, userID);
});

$('.icon#take_video').click(function(){
    $('.icon#take_video').animate({height:"40px",width:'40px'},100, function(){
        $('.icon#take_video').animate({height:"35px",width:'35px'},100);
    });
    $('.icon').hide(animSpeed);
    socket.emit("back_video");
    back_video(false);
    dbLog(EventType.backToVideo, userID);
});

$('.icon#hand').click(function(){
    if (isShowingImg) {
        isMovingImg = true;
        $(wrap_them).css("z-index", "3");
        $(wrap_me).css("z-index", $('#canvas_me').css('z-index'));

        $('.icon#hand').css('border-color', 'red');
        $('.icon#arrow').css('border-color', 'transparent');
        $('.icon#pen').css('border-color', 'transparent');
        socket.emit('start_move_image');
        dbLog(EventType.selectHand, userID);
    }
});

$('.icon#arrow').click( function() {
    $('.icon#arrow').animate({height:"35px",width:'35px'},100, function(){
        $('.icon#arrow').animate({height:"30px",width:'30px'},100);
    });
    sendCursorToThem = true;
    $('.icon#arrow').css('border-color', 'red');
    $('.icon#pen').css('border-color', 'transparent');
    $('.picker').hide(animSpeed, 'easeOutBounce');
    stopMovingImg();
    dbLog(EventType.selectCursor, userID);
});

$('.icon#pen').click( function() {
    $('.icon#pen').animate({height:"35px",width:'35px'},100, function(){
        $('.icon#pen').animate({height:"30px",width:'30px'},100);
    });
    sendCursorToThem = false;
    $('.icon#arrow').css('border-color', 'transparent');
    $('.icon#pen').css('border-color', 'red');
    $('.picker').show(animSpeed, 'easeOutBounce');
    stopMovingImg();
    dbLog(EventType.selectPen, userID);
});

function stopMovingImg() {
    isMovingImg = false;
    $(wrap_them).css("z-index", "1");
    $(wrap_me).css("z-index", "1");
    $('.icon#hand').css('border-color', 'transparent');
    socket.emit('stop_move_image');
}

$('.icon#palette').click(function(){
    $('.icon#palette').animate({height:"35px",width:'35px'},100, function(){
        $('.icon#palette').animate({height:"30px",width:'30px'},100);
    });
    particle.fillColor = '#' + (Math.random() * 0x404040 + 0xaaaaaa | 0).toString(16);
    $(this).css('background-color', particle.fillColor);
}).css('background-color', "rgb(200, 22, 161)");

$('.icon#eraser').click(function(){
    $('.icon#eraser').animate({height:"35px",width:'35px'},100, function(){
        $('.icon#eraser').animate({height:"30px",width:'30px'},100);
    });
    trailTime = 0;
    mouseIsDown = false;
    clearTimeout(timeout_id);
    socket.emit('clear');
});


$("#spectrum").spectrum({
    replacerClassName: 'picker',
    showPalette:true,
    showPaletteOnly:true,
    palette: [
        ['black', 'white', 'blanchedalmond',
            'rgb(255, 128, 0);'],
        ['yellow', 'green', 'blue', 'red']
    ],
    change: function(color) {
        particle.fillColor = color.toHexString();
        dbLog(EventType.selectColor, userID);
    }
});

$('.icon#hangup').click( function(){
    isCalling = !isCalling;
    if (!isCalling) {
        endCall();
        socket.emit('end_call');
        $('.icon#hangup').attr('src', 'image/phone.png');
        dbLog(EventType.stopCall, userID);
    }
    else {
        $('.icon#hangup').attr('src', 'image/hangup.png');
        //$('.icon#hangup').css('opacity', '0.2');
        socket.emit('recall');
        dbLog(EventType.reCall, userID);
    }
});

function endCall(){
    webrtcCall.releaseLocalStream();
    remoteStream.stop();
    localStream.stop();
    //webrtcCall.end();
};

function createNewStream() {
    var cb = function(err, stream) {
        if (err)    throw err;
        localStream = stream;

        if (!isFlipVideo) localStream.pipe($("#me"));
        else localStream.pipe($("#them"));

        socket.emit("ready_recall");
    };

    var constrain = videoSource == 0?frontCamConstraint:rearCamConstraint;
    /*
    var constrain = {   audio: false,
                        "video": {
                            "mandatory": {
                                "minWidth": "720",
                                "minHeight": "540",
                                "maxWidth": "720",
                                "maxHeight": "540"
                            },
                            "optional": []
                    }};
    */
    holla.createStream(constrain, cb);
};

/////////////////////////////////////
// Database log

var EventType = {   swapVideos: "button_down_video_swap",
                    hideSmallVideo: "button_down_video_small_hide",
                    showSmallVideo: "button_down_video_small_show",
                    switchCameras: "button_down_camera_switch",
                    showThumbnails: "button_down_thumbnail_show",
                    hideThumbnails: "button_down_thumbnail_hide",
                    takePhoto: "button_down_photo_take",
                    backToVideo: "button_down_video_back",
                    selectCursor: "button_down_cursor_select",
                    selectPen: "button_down_pen_select",
                    selectHand: "button_down_hand_select",
                    selectColor: "button_down_color_select",
                    startDraw: "finger_down_line_draw",
                    stopDraw: "finger_up_line_draw",
                    startCursor: "finger_down_cursor_move",
                    stopCursor: "finger_up_cursor_move",
                    stopCall: "button_down_phone_stop",
                    reCall: "button_down_phone_call",
                    selectThumbnail: "finger_down_thumbnail_select",
                    receiveImage: "image_receive",
                    fingerDrag: "finger_drag"
                };
function dbLog(eventType, userID, info) {
    var jsonData = {"event_type": eventType,
                    "user_id": userID,
                    "info": info,
                    "time_stamp": new Date().toISOString()
                    };
    socket.emit('log', JSON.stringify(jsonData));
}

///////////////////////////////////////////////////////////
function reloadIcons() {
    $('#me').bind('resize', function() {
        displayIcons();
        $('#me').unbind('resize');
        //$('#them').unbind('resize');
    });
    $('#them').bind('resize', function() {
        displayIcons();
        //$('#me').unbind('resize');
        $('#them').unbind('resize');
    });
}

function swapVideos() {
    isFlipVideo = !isFlipVideo;

    var me = $('#me');
    var them = $('#them');

    me.attr('id', 'them').attr('class', 'them');
    if (me.prop('tagName') === 'VIDEO') { me.attr('muted', false); }
    them.attr('id', 'me').attr('class', 'me');
    if (them.prop('tagName') === 'VIDEO') { me.attr('muted', true); }
}

function showCursors(data) {
    if (!isCursorTrace) {
        $('#cursor').show();
        var at = isFlipVideo ? (data.at == "me" ? "them" : "me") : data.at;

        moveCursor(at,
                data.x * $('#canvas_' + at).width(),
                data.y * $('#canvas_' + at).height());
    }
    else {
        if (cursorArray.length < cursorMax) {
            var at = isFlipVideo ? (data.at == "me" ? "them" : "me") : data.at;
            var cursorDiv = $('<div>', {
                id: 'cursorDiv' + cursorIndex,
                class: 'cursorArrow'
            }).appendTo(document.body).show();
            var cursorImg = $('<img>', {
                id: 'cursor' + cursorIndex,
                src: cursorData.src
            }).appendTo(cursorDiv).show();


            var cursorX = data.x * $('#canvas_' + at).width();
            var cursorY = data.y * $('#canvas_' + at).height();

            cursorDiv.css('left', $('#canvas_' + at).offset().left + cursorX)
                .css('top', $('#canvas_' + at).offset().top + cursorY);
            if (at =='me')
                cursorDiv.css('z-index',"4");
            else
                cursorDiv.css('z-index',"1");

            cursorArray.push(cursorDiv);

        }

        if (!data.local) {
            if (!isFirstCursor) {
                isFirstCursor = true;
                cursorRemoteTime = 0;
            }
        }
    }
}