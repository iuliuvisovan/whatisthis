var express = require('express');
var app = express();
var server = app.listen(process.env.PORT || 3000, () => console.log(`Running on ${process.env.PORT || 3000}!`));
var io = require('socket.io').listen(server);
var path = require('path');
var handler = require('./whatisthis-server');

app.use(express.static(path.join(__dirname, '/public')));
app.use('/bower_components', express.static(path.join(__dirname, '/bower_components')));

app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));
handler.init(io);