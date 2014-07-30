## Install

1. Download repository
2. Run `make build`

## How to run it

Run `node app.js` in root of repository

** CSV data log feature ** 
 - Install MongoDB package: http://docs.mongodb.org/manual/installation/ 
 - Run MongoDB before starting server
 - Log data will be store in ./database/log.csv file
 
## Bugs

* If the connection is too bad the call ends, would be nice to refresh the page if that happens
* Sometimes the browser does not ask user permission to use the camera and nothing happens, have to refresh the page (https://github.com/wearefractal/holla/issues/31)
* Randomly you can only draw straight lines, have to press the clear button to go back to normal
* In high res if the image is taken in portrait mode then there is a flickering effect before doing any zoom (https://github.com/rombdn/img-touch-canvas/issues/3)
* The disconnect socket sometimes is not triggered. Have to implement something that checks whether clients are connected or not

