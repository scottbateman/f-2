build: node_modules ./public/firebase.js ./public/img-touch-canvas.js \
	./public/jquery.hammer.min.js ./public/jquery.js ./public/resize.js \
	./public/screenshot.js
	cd ./node_modules/holla/ && \
		npm install && \
		npm install coffee-script@1.6 && \
		make build
	cp ./node_modules/holla/holla.js ./public/

./public/firebase.js:
	wget -P ./public/ https://cdn.firebase.com/js/client/1.0.11/firebase.js

./public/img-touch-canvas.js:
	wget -P ./public/ https://raw.githubusercontent.com/rombdn/img-touch-canvas/master/img-touch-canvas.js

./public/jquery.hammer.min.js:
	wget -P ./public/ https://raw.githubusercontent.com/EightMedia/jquery.hammer.js/master/jquery.hammer-full.min.js
	mv ./public/jquery.hammer-full.min.js ./public/jquery.hammer.min.js

./public/jquery.js:
	wget -P ./public/ http://code.jquery.com/jquery-1.11.1.js
	mv ./public/jquery-1.11.1.js ./public/jquery.js

./public/resize.js:
	wget -P ./public/ https://raw.githubusercontent.com/cowboy/jquery-resize/v1.1/jquery.ba-resize.min.js
	mv ./public/jquery.ba-resize.min.js ./public/resize.js

./public/screenshot.js:
	wget -P ./public/ https://www.webrtc-experiment.com/screenshot.js

node_modules:
	npm install

clean:
	@echo "Removing modules and libraries"
	@rm -rf ./node_modules ./public/holla.js ./public/firebase.js \
		./public/img-touch-canvas.js ./public/jquery.hammer.min.js \
		./public/jquery.js ./public/resize.js ./public/screenshot.js
