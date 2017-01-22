var players = [];
var existingWords;

//iuliuvisovan
//API KEY: AIzaSyBfucJbnA_QUnXMEdZf7yZv1fOpFF7Iyw4
//CSE ID: 007960637259156093421:jn6qog3skvm

//thezingcollection2
//API KEY: AIzaSyCZiHDBCcIzdqKa1SL0XBlxtUUcf_VqO-c
//CSE ID: 012529666448905206368:ldg-wfa5wmc

//lamaieeee
//API KEY: AIzaSyAjoJ0G13cV1SKfZTT0M2OwxVmkVRVWigk
//CSE ID: 016970297345844598714:yudpwuyp-yq

const fs = require('fs');
const ImagesClient = require('google-images');
var googleClient;

module.exports = {
    init: (io) => {
        setWordImages();
        io.on('connection', socket => {
            players.push({
                id: socket.id,
                name: '<some unknown guy>',
                score: 0,
                questionIndex: 0
            });
            io.emit('playerlistupdate', J(players));
            socket.on('playerUpdated', playerJson => {
                var player = JSON.parse(playerJson);
                var localPlayer = findPlayer(socket.id);
                localPlayer.name = player.name || '<some unknown guy>';
                localPlayer.score = player.score;
                socket.broadcast.emit('playerlistupdate', J(players));
            });
            socket.on('disconnect', playerJson => {
                players = players.filter(x => x.id != socket.id);
                io.emit('playerlistupdate', J(players));
                if (isGameStarted)
                    io.emit('interrupt');
                isGameStarted = false;
            });
            socket.on('go', () => {
                if (isGameStarted)
                    return;
                populateQuestions();
                socket.broadcast.emit('go');
                isGameStarted = true;
                io.emit('questionArrived', JSON.stringify({
                    question: questions[questions.length - 1].imageUrl,
                    answer: questions[questions.length - 1].word,
                    currentPlayerScore: 0
                }));
            });
            socket.on('answerPush', response => {
                var currentPlayer = findPlayer(socket.id);
                var isRightAnswer = response.toLowerCase().trim() == questions[questions.length - 1 - currentPlayer.questionIndex].word.toLowerCase().trim();
                currentPlayer.questionIndex++;
                if(isRightAnswer)
                currentPlayer.score = currentPlayer.score + 1;
                else {
                    io.emit('playermissed', socket.id);
                }

                io.emit('playerlistupdate', J(players));
                if (currentPlayer.score > 5) {
                    io.emit('end', currentPlayer.name);
                    players.forEach((player) => {
                        player.score = 0;
                        questionIndex = 0;
                    })
                    return;
                }
                if (currentPlayer.questionIndex > questions.length - 1)
                    populateQuestions();
                socket.emit('questionArrived', JSON.stringify({
                    question: questions[questions.length - 1 - currentPlayer.questionIndex].imageUrl,
                    answer: questions[questions.length - 1 - currentPlayer.questionIndex].word,
                    currentPlayerScore: currentPlayer.score
                }));
            });
        });
    },
}



var isGameStarted = false;
var findPlayer = (id) => players.find(x => x.id == id);
var J = (string) => JSON.stringify(string);

var questions = [];
var operators = ['+', '-'];
var populateQuestions = () => {
    var availableWords = JSON.parse(fs.readFileSync('words.json', 'utf8')).filter(x => x.imageUrl.length);
    for (var i = 0; i < 50; i++) {
        var randNum = Math.floor(Math.random() * (availableWords.length - 1));
        if (!questions.some(x => x.word == availableWords[randNum].word))
            questions.push(availableWords[randNum]);
    }
}

var setWordImages = () => {
    rawWords = fs.readFileSync('rawwords.txt', 'utf8');
    existingWords = JSON.parse(fs.readFileSync('words.json', 'utf8'));
    var updatedWords = rawWords.split("\n")
        .map(x => x.trim())
        .filter(x => x.length)
        .map(wordString => {
            return {
                word: wordString,
                imageUrl: (existingWords.find(x => x.word == wordString) && existingWords.find(x => x.word == wordString).imageUrl) || ""
            }
        });
    debugger;
    Promise.all(updatedWords
            .filter(word => (word.word && word.word.length) && (!word.imageUrl || !word.imageUrl.length))
            .map(word => updateImageForWord(word)))
        .then(() => {
            fs.writeFile('./words.json', JSON.stringify(updatedWords, null, 4), function (err) {
                console.log("Word images updated succesfully!");
            });
        })
}

function updateImageForWord(word) {
    return new Promise((resolve, reject) => {
        //thezingcollection2
        // googleClient = new ImagesClient('012529666448905206368:ldg-wfa5wmc', 'AIzaSyCZiHDBCcIzdqKa1SL0XBlxtUUcf_VqO-c');

        //iuliuvisovan
        // googleClient = new ImagesClient('007960637259156093421:jn6qog3skvm', 'AIzaSyBfucJbnA_QUnXMEdZf7yZv1fOpFF7Iyw4');

        //lamaieeee
        googleClient = new ImagesClient('016970297345844598714:yudpwuyp-yq', 'AIzaSyAjoJ0G13cV1SKfZTT0M2OwxVmkVRVWigk');


        googleClient.search(word.word).then(images => {
            let imageUrl = "";
            images.sort((a,b) => a.size < b.size ? 1 : -1).forEach(image => {
                if(image.height > 250 && !image.url.includes('pixabay')) { 
                    imageUrl = image.url;
                    return;
                }
            });
            word.imageUrl = imageUrl;
            resolve();
        }).catch(err => console.dir(err));
    });
}