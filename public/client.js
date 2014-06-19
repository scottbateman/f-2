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

function main_interval(){
mainInterval = setInterval(function(){
   counter++;

   if(counter >= trailTime){
      me.fillStyle = 'rgba(0,0,0,0.11)';
      me.fillRect(0, 0, me.canvas.width, me.canvas.height);

      if(them){
         them.fillStyle = 'rgba(0,0,0,0.11)';
         them.fillRect(0, 0, them.canvas.width, them.canvas.height);
      }
   }

   if(mouseIsDown && draw && !sendCursorToThem) {
      var lp = { x: particle.position.x, y: particle.position.y };

      particle.shift.x += (mouseX - particle.shift.x) * (particle.speed);
      particle.shift.y += (mouseY - particle.shift.y) * (particle.speed);

      particle.position.x = particle.shift.x + Math.cos(particle.offset.x);
      particle.position.y = particle.shift.y + Math.sin(particle.offset.y);

      draw(draw_at, lp.x, lp.y, particle.position.x, particle.position.y, particle.size, particle.fillColor);

      trailTime = counter + Math.pow(10, $("#time").val());

      socket.emit('draw', {
         'x1': lp.x / $("#canvas_" + draw_at).width(),
         'y1': lp.y / $("#canvas_" + draw_at).height(),
         'x2': particle.position.x / $("#canvas_" + draw_at).width(),
         'y2': particle.position.y / $("#canvas_" + draw_at).height(),
         'size': particle.size,
         'color': particle.fillColor,
         'trailTime': Math.pow(10, $("#time").val()),
         'draw_at': isFlipVideo ? (draw_at == "me" ? "them" : "me") : draw_at
      });
   } else if (mouseIsDown && sendCursorToThem) {
      socket.emit('show_cursor', {
         x: mouseX / $("#canvas_" + draw_at).width(),
         y: mouseY / $("#canvas_" + draw_at).height(),
         at: isFlipVideo ? draw_at : (draw_at === "me" ? "them" : "me")
      });
   }
}, 1000 / 60);
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

      localStream.pipe($("#me"));

      if(!$("#picture").val()){
         $(".me").show();
      }

      socket.emit("ready");
   };

   holla.createStream({audio: false, video: true}, cb);
}

function hideCursor() {
   console.log('hiding cursor');
   $('#cursor').hide();
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

   // $("#canvas_them").hammer().on("doubletap", function(){
   //    if($("#img_canvas").is(":visible")){
   //       $("#remove").click();
   //       stopDrawing = true;
   //       $("#canvas_them").css("z-index", "0");
   //    }
   // });
   //
   // $("#img_canvas").hammer().on("doubletap", function(){
   //    stopDrawing = false;
   //    $("#canvas_them").css("z-index", "1");
   // });

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
            displayIcons();
            return remoteStream.pipe($("#them"));
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
                     displayIcons();
                     return stream.pipe($("#them"));
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

	$("#size").change(function(){
		particle.size = Math.pow(5, $(this).val());
	});

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
             //localStream.getVideoTracks()[0].enabled = false;
         }

         $('.icon#take_video').show();
         $('.icon#take_photo').hide();
         isTakingPhoto = true;
         $('.icon#switch_cam').hide();
         $('.icon#thumbnail').hide();
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
      }
   });

   socket.on('send_icon', function(data) {
      $('.icon#switch_cam').hide();
      $('.icon#thumbnail').hide();
      displayPicture(isFlipVideo ? "me" : "them", data.src);
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
		}
	});

	$("#canvas_me, #canvas_them").bind("touchstart mousedown", function(e){
		if(!stopDrawing){
			if(e.originalEvent.touches){
				mouseX = e.originalEvent.touches[0].pageX - $(this).offset().left;
				mouseY = e.originalEvent.touches[0].pageY - $(this).offset().top;
		
				e.stopPropagation(); 
				e.preventDefault();
			}
			else{
				mouseX = e.pageX - $(this).offset().left;
				mouseY = e.pageY - $(this).offset().top;
			}

			draw_at = $(this).attr("class");

			if(draw_at == "high_res"){
				draw_at = "them";
			}		

			particle.shift.x += (mouseX - particle.shift.x);
			particle.shift.y += (mouseY - particle.shift.y);

			particle.position.x = particle.shift.x + Math.cos(particle.offset.x);
			particle.position.y = particle.shift.y + Math.sin(particle.offset.y);

			mouseIsDown = true;
		
			socket.emit('mousedown', {
				'x': particle.position.x,
				'y': particle.position.y,
				'mouseIsDown': mouseIsDown,
				'draw_at': draw_at
			});
		}
	});
	
   $("#canvas_me, #canvas_them").bind("touchend mouseup", function(){
      mouseIsDown = false;
      if (sendCursorToThem) {
         socket.emit('hide_cursor');
      }
   });

	$("#img_canvas").bind("touchend mouseup", function(){
		send_image();
	});

	socket.on('draw', function(data) {
		var flip;

		// if($("#photo").is(":visible")){
		// 	flip = data.draw_at == "me" ? "them" : "me";
		// }
		// else{
		// 	flip = "them";// + data.draw_at;
      //
		// 	if(sync == true){
		// 		stopDrawing = false;
		// 		$("#canvas_them").css("z-index", "1");				
		// 	}
		// }

      // flip = data.draw_at == "me" ? "them" : "me";
      // flip = $("#flip_video").is(':checked') ? (flip == "me" ? "them" : "me") : flip;
      // next if replaces previous 2 lines
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
			
		trailTime = counter + data.trailTime;
	});

   socket.on('show_cursor', function(data) {
      $('#cursor').show();
      var at = isFlipVideo ? (data.at == "me" ? "them" : "me") : data.at;

      moveCursor(at,
         data.x * $('#canvas_' + at).width(),
         data.y * $('#canvas_' + at).height());
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
        $(wrap_them).css("z-index", "3");
        isMovingImg = true;
    });
    socket.on('stop_move_image', function() {
        $(wrap_them).css("z-index", "1");
        isMovingImg = false;
    });

    socket.on('hide_thumbnails', function() {
        removeImg();
    });
});

function init_drawing() {
	mouseX = $("#me").width() * 0.5;
	mouseY = $("#me").height() * 0.5;

	canvas_me = document.getElementById('canvas_me');
	canvas_them = document.getElementById('canvas_them');
    wrap_me = document.getElementById('wrap_me');
    wrap_them = document.getElementById('wrap_them');

	if (canvas_me && canvas_me.getContext) {
		me = canvas_me.getContext('2d');
		them = canvas_them.getContext('2d');

		particle = {
			size: Math.pow(5, $("#size").val()),
			position: { x: mouseX, y: mouseY },
			offset: { x: 0, y: 0 },
			shift: { x: mouseX, y: mouseY },
			speed: 0.3,
			fillColor: "rgb(200, 22, 161)"
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
      .css('left', $('#' + at).offset().left + x)
      .css('top', $('#' + at).offset().top + y);
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
    //$('#wrap_me').css("z-index","-2").hide().empty();
    //$('#wrap_them').css("z-index","-2").hide().empty();
    $(wrap_me).css("z-index","1").empty().show();
    $(wrap_them).css("z-index","1").empty().show();
    // Enable video stream, show video
    //localStream.getVideoTracks()[0].enabled = true;
    $('video#me').show();
    $('video#them').show();
    isTakingPhoto = false;
    isShowingImg = false;
    displayIcons();
    resizeCanvas();
    if (!isReceiver)
        callAgain(0);
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
    $('video#them').hide();
    $(wrap_me).css("z-index","3").show();
    $(wrap_them).css("z-index","3").show();

    img.css("position", "relative");
    img.css("top", "0px");
    img.css("left", "0px");

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
var currentImg,wrap_me,wrap_them, originW, originH,lastScrollY;

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
                left: parseInt($(targetImg).css('left')) / parseInt(wrap.css( 'width' ))
            });

            break;

        case 'release':
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

            socket.emit('move_image', {
                top: imgY / parseInt(wrap.css( 'height' )) ,
                left: imgX / parseInt(wrap.css( 'width' )),
                imgScale: imgWidth / originW
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
        }
        if (data.imgScale) {
            currentImg.css('width', data.imgScale * originW + 'px');
            currentImg.css('height', data.imgScale * originH + 'px');
        }
    }
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
var videoSource;
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
    holla.createStream({video:{optional: [{sourceId: sourceIDs[sourceID]}]},audio:false}, function(error, stream){
        if (error) {
            alert(error);
            throw error;
        }
        localStream = stream;
        stream.pipe($('#me'));

        rtc.createCall(function(err, call) {
            webrtcCall = call;

            if (err) {
                throw err;
            }

            console.log("Created call again", webrtcCall);

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
                    return stream.pipe($("#them"));
                });
            }
            isFlipVideo = false;
        });
    });
};

/////////////////////////////////////////////////////
// Image thumbnails
var isMovingImg = true;
var isShowingImg = false;
$('.icon#thumbnail').click(function() {
    $('.icon#thumbnail').animate({height:"45px",width:'45px'},100, function(){
        $('.icon#thumbnail').animate({height:"40px",width:'40px'},100);
    });
    isShowingThumbnail = !isShowingThumbnail;
    if (isShowingThumbnail) {
        var wrap = document.getElementById('wrap_scroll');
        $(wrap).css('top', '18%').empty();
        socket.emit('get_thumbnails');
        $('#wrap_thumb').animate({'height':"37.5%"},500);
        $('.icon#take_photo').hide(animSpeed);
        $('.icon#switch_cam').hide(animSpeed);
    }
    else {
        $('#wrap_thumb').animate({'height':"0%"},500, function(){
            $('#wrap_scroll').empty();

            socket.emit('hide_thumbnails');
            $('.icon#take_photo').show(animSpeed);
            $('.icon#switch_cam').show(animSpeed);

            removeImg();
        })
    }
});

function removeImg() {
    $('#wrap_me').empty();
    $('#wrap_them').empty();
    $('#them').show();
    isShowingImg = false;
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

    img.on('click', function(){
        socket.emit('get_image', imgName);
        $('#loading').css('top', $(canvas_them).height() / 2).css('left', $(canvas_them).width() / 2).show();
    });
}

function receiveImage(data){
    if (data.local) {
        displayPicture(isFlipVideo ? "them" : "me", data.src);
    }
    else {
        displayPicture(isFlipVideo ? "me" : "them", data.src);
        originW = parseInt( currentImg.css( 'width' ) );
        originH = parseInt( currentImg.css( 'height' ) );
    }
    $('#loading').hide();
}

function resizeImg(wrapDiv,img)
{
    var ratio = parseInt(img.css("width")) / parseInt(img.css("height"));
    if (ratio > 1)
    {
        img.css("width", ($(wrapDiv).width())+"px");
        img.css("height", (ratio/img.width)+"px");
    }
    else
    {
        img.css("height", ($(wrapDiv).height())+'px');
        img.css("width", (ratio*img.height)+"px");
    }
}

//////////////////////////////
// Icons
var animSpeed = 300;
var isShowSmallVideo = true;
var videoMeWidth,videoMeHeight;
var isFlipVideo = false;
var isTakingPhoto = false;
var isShowingThumbnail = false;

$('.icon#hide_video').click(function(){
    $('.icon#hide_video').animate({height:"35px",width:'35'},100, function(){
        $('.icon#hide_video').animate({height:"30px",width:'30'},100);
    });
    showSmallVideo();
});

function showSmallVideo() {
    var me = $('#me');
    var myCanvas = $('#canvas_me');
    var iHideVideo = $('.icon#hide_video');
    var iSwapVideo = $('.icon#swap_video');
    if (!isShowSmallVideo) {
        iHideVideo.animate({
            right:(videoMeWidth - parseInt(iHideVideo.css('width')))+'px',
            bottom:(videoMeHeight - parseInt(iHideVideo.css('height')))+'px'
        },animSpeed*0.3, function() { $('.icon#switch_cam').show(); });
        iSwapVideo.animate({bottom:(videoMeHeight - parseInt(iSwapVideo.css('width')))+'px'},animSpeed*0.5);
        iSwapVideo.show(animSpeed);
        me.show(animSpeed);
        myCanvas.show();
        isShowSmallVideo = true;
        $('.icon#hide_video').attr('src', 'image/arrow_hide.png');
    } else {
        videoMeWidth = parseInt(me.css('width'));
        videoMeHeight = parseInt(me.css('height'));
        iHideVideo.animate({right:"0px",bottom:'0px'},animSpeed*0.5, function(){
            myCanvas.hide();
        });
        iSwapVideo.animate({bottom:'0px'},animSpeed*0.5);
        iSwapVideo.hide(animSpeed);
        me.hide(animSpeed);
        isShowSmallVideo = false;
        if(!isFlipVideo) $('.icon#switch_cam').hide();
        $('.icon#hide_video').attr('src', 'image/arrow_show.png');
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

    iThumbnail.css('top', '10%').css('right', '5%').css('width','40px').css('height', '40px');
    iSwitchCam.css('width','40px').css('height', '40px');
    iTakePhoto.css('top', '2%').css('right', '6%').css('width','30px').css('height', '30px');
    iTakeVideo.css('top', '2%').css('right', '6%').css('width','30px').css('height', '30px');
    if (isTakingPhoto) {
        iTakePhoto.hide();
        videoMe.hide();
        videoThem.hide();
    }
    else
        iTakeVideo.hide();

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
        iPen.css('border-color', 'transparent');
        iCursor.css('border-color', 'transparent');
        iHand.css('border-color', 'red').css('opacity', '1');

        $('#them').hide()
    }

    if (isFlipVideo) {
        iSwitchCam.css('left', (parseInt(videoThem.css('width'))/2 - parseInt(iSwitchCam.css('width'))/4) +'px');
        iSwitchCam.css('top', '2%');
    }
    else {
        iSwitchCam.css('left','auto').css('right', (parseInt(videoMe.css('width'))/2 - parseInt(iSwitchCam.css('width'))/2) +'px');
        iSwitchCam.css('top', 'auto').css('bottom', (parseInt(videoMe.css('height')) - parseInt(iSwitchCam.css('height'))) +'px');
    }

    if (isShowingThumbnail) {
        $('.icon#take_photo').hide();
        $('.icon#switch_cam').hide();
    }

    iHangUp.css('bottom', '12%').css('left', '25%').css('width','35px').css('height', '35px');

    $('.icon').each(function(e) {
        var element = $('.icon')[e];
        var w = element.width;
        //$(element).css('background-size', w+'px' );
        //$(element).css('border-radius', w/2+2+'px' );
        //$(element).css('border-radius', '50%' );
    });
}

$('.icon#swap_video').click(function(){
    isFlipVideo = !isFlipVideo;
    if (currentImg){
        $(currentImg).css('top', '0px');
        $(currentImg).css('left', '0px');
        var parentDiv = $(currentImg).parent();
        if (parentDiv.attr('class') == 'me') {
            $(currentImg).appendTo($(wrap_them));
            resizeImg(wrap_them, currentImg);
        }
        else {
            if ($('#hide_thumbnail').is(":visible"))
                $(currentImg).appendTo($(wrap_me));
            resizeImg(wrap_me, currentImg);
        }
        originW = parseInt( currentImg.css( 'width' ) );
        originH = parseInt( currentImg.css( 'height' ) );
    }

    var me = $('#me');
    var them = $('#them');
    me.hide(animSpeed*0.5);
    them.hide(animSpeed *0.5);
    $('.icon').hide();
    $('#canvas_me').hide();
    $('#canvas_them').hide();

    me.attr('id', 'them').attr('class', 'them');
    if (me.prop('tagName') === 'VIDEO') { me.attr('muted', false); }
    them.attr('id', 'me').attr('class', 'me');
    if (them.prop('tagName') === 'VIDEO') { me.attr('muted', true); }

    me.show(animSpeed);
    them.show(animSpeed, function(){
        $('#canvas_me').show();
        $('#canvas_them').show();
        resizeCanvas();
        displayIcons();
    });
});

$('.icon#switch_cam').click(function(){
    $('.icon#switch_cam').animate({height:"45px",width:'45px'},100, function(){
        $('.icon#switch_cam').animate({height:"40px",width:'40px'},100);
    });
    camera1 = !camera1;
    if (camera1)
        videoSource = 0;
    else
        videoSource = 1;

    callAgain(videoSource);
});

$('.icon#take_photo').click(function(){
    $('.icon#take_photo').animate({height:"35px",width:'35px'},100, function(){
        $('.icon#take_photo').animate({height:"30px",width:'30px'},100);
    });
    if (localStream) localStream.stop();
    $('#me').hide();
    $('input#icon').click();
});

$('.icon#take_video').click(function(){
    $('.icon#take_video').animate({height:"35px",width:'35px'},100, function(){
        $('.icon#take_video').animate({height:"30px",width:'30px'},100);
    });
    $('.icon').hide(animSpeed);
    socket.emit("back_video");
    back_video(false);
});

$('.icon#hand').click(function(){
    if (isShowingImg) {
        isMovingImg = true;
        $(wrap_them).css("z-index", "3");
        $(wrap_me).css("z-index", "3");

        $('.icon#hand').css('border-color', 'red');
        $('.icon#arrow').css('border-color', 'transparent');
        $('.icon#pen').css('border-color', 'transparent');
        socket.emit('start_move_image');
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
    palette: [
        ['black', 'white', 'blanchedalmond',
            'rgb(255, 128, 0);'],
        ['yellow', 'green', 'blue', 'violet']
    ],
    change: function(color) {
        particle.fillColor = color.toHexString();
    }
});

$('.icon#hangup').click( function(){
    webrtcCall.end();
});
