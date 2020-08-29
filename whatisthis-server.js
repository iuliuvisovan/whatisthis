const fs = require("fs");
const ImagesClient = require("google-images");
const stringMatcher = require("./public/js/levenstein");
const download = require("image-downloader");

var players = [];
var existingWords;
var googleClient;

//iuliuvisovan
//API KEY: AIzaSyBfucJbnA_QUnXMEdZf7yZv1fOpFF7Iyw4
//CSE ID: 007960637259156093421:jn6qog3skvm

//thezingcollection2
//API KEY: AIzaSyCZiHDBCcIzdqKa1SL0XBlxtUUcf_VqO-c
//CSE ID: 012529666448905206368:ldg-wfa5wmc

//lamaieeee
//API KEY: AIzaSyAjoJ0G13cV1SKfZTT0M2OwxVmkVRVWigk
//CSE ID: 016970297345844598714:yudpwuyp-yq

module.exports = {
  init: (io) => {
    // setWordImages();
    downloadImages();
    io.on("connection", (socket) => {
      players.push({
        id: socket.id,
        name: "<no name>",
        score: 0,
        questionIndex: 0,
        winCount: 0,
      });
      io.emit("playerlistupdate", J(players));
      if (isGameStarted) {
        socket.emit("go");
        socket.emit(
          "questionArrived",
          JSON.stringify({
            question: questions[questions.length - 1].imageUrl,
            answer: questions[questions.length - 1].word,
            currentPlayerScore: 0,
          })
        );
      }
      socket.on("playerUpdated", (playerJson) => {
        var player = JSON.parse(playerJson);
        var localPlayer = findPlayer(socket.id);
        localPlayer.name = player.name || "<no name>";
        localPlayer.score = !isGameStarted ? player.score : 0;
        localPlayer.winCount = player.winCount;
        socket.broadcast.emit("playerlistupdate", J(players));
      });
      socket.on("disconnect", (playerJson) => {
        players = players.filter((x) => x.id != socket.id);
        io.emit("playerlistupdate", J(players));
        if (players.length < 2) {
          if (isGameStarted) {
            io.emit("interrupt");
          }
          players.forEach((player) => {
            player.score = 0;
            player.questionIndex = 0;
          });
          isGameStarted = false;
        }
      });
      socket.on("go", () => {
        if (isGameStarted) return;
        players.forEach((player) => {
          player.score = 0;
          player.questionIndex = 0;
        });
        populateQuestions();
        io.emit("imagesPrecache", J(questions.map((x) => x.imageUrl).slice(questions.length - 10)));
        socket.broadcast.emit("go");
        isGameStarted = true;
        io.emit("playerlistupdate", J(players));
        io.emit(
          "questionArrived",
          JSON.stringify({
            question: questions[questions.length - 1].imageUrl,
            answer: questions[questions.length - 1].word,
            currentPlayerScore: 0,
          })
        );
      });
      socket.on("answerPush", (response) => {
        if (!isGameStarted) return;
        var currentPlayer = findPlayer(socket.id);
        var isRightAnswer = stringMatcher.isLevenshteinMatch(response, questions[questions.length - 1 - currentPlayer.questionIndex].word);
        currentPlayer.questionIndex++;
        if (isRightAnswer) currentPlayer.score = currentPlayer.score + 1;
        else {
          io.emit(
            "playermissed",
            JSON.stringify({
              playerId: socket.id,
              playerMissedWord: response,
            })
          );
        }
        if (currentPlayer.questionIndex % 5 == 0) {
          socket.emit("imagesPrecache", J(questions.map((x) => x.imageUrl).slice(questions.length - 1 - currentPlayer.questionIndex - 10)));
        }
        io.emit("playerlistupdate", J(players));
        if (currentPlayer.score > 8) {
          isGameStarted = false;
          currentPlayer.winCount++;
          io.emit("end", JSON.stringify(currentPlayer));
          questions = [];
          populateQuestions();
          players.forEach((player) => {
            player.score = 0;
            player.questionIndex = 0;
          });
          io.emit("playerlistupdate", J(players));
          return;
        }
        if (currentPlayer.questionIndex > questions.length - 11) {
          //They ran out of questions
          populateQuestions();
        }

        socket.emit(
          "questionArrived",
          JSON.stringify({
            question: questions[questions.length - 1 - currentPlayer.questionIndex].imageUrl,
            answer: questions[questions.length - 1 - currentPlayer.questionIndex].word,
            currentPlayerScore: currentPlayer.score,
          })
        );
      });
    });
  },
};

var isGameStarted = false;
var findPlayer = (id) => players.find((x) => x.id == id);
var J = (object) => JSON.stringify(object);

var questions = [];
var operators = ["+", "-"];
var populateQuestions = () => {
  var availableWords = JSON.parse(fs.readFileSync("words.json", "utf8")).filter((x) => x.imageUrl.length);
  for (var i = 0; i < 50; i++) {
    var randNum = Math.floor(Math.random() * (availableWords.length - 1));
    if (!questions.some((x) => x.word == availableWords[randNum].word)) questions.push(availableWords[randNum]);
  }
};

var setWordImages = () => {
  const rawWords = fs.readFileSync("rawwords.txt", "utf8");
  const existingWords = JSON.parse(fs.readFileSync("words.json", "utf8"));

  const updatedWords = rawWords
    .split("\n")
    .map((x) => x.trim())
    .filter((x) => x.length)
    .map((wordString) => {
      return {
        word: wordString,
        imageUrl: existingWords.find((x) => x.word == wordString)?.imageUrl,
      };
    });

  Promise.all(
    updatedWords
      .filter((word) => word.word.length && !word.imageUrl?.length)
      .slice(0, 50)
      .map((word) => updateImageForWord(word))
  ).then(() => {
    fs.writeFile("./words.json", JSON.stringify(updatedWords, null, 4), () => {
      console.log("Word images updated succesfully!");
    });
  });
};

const downloadImages = async () => {
  const words = JSON.parse(fs.readFileSync("words.json", "utf8"));

  words.forEach((x) => {
    if (!x.imageUrl) {
      console.log("word without image: ", x.word);
    }

    x.imageUrlBroken = x.imageUrl;
    x.imageUrl = undefined;
  });

  console.log("words", words.length);
  console.log("words.filter((x) => x.imageUrlBroken).length", words.filter((x) => x.imageUrlBroken).length);

  await Promise.all(
    words
      .filter((x) => x.imageUrlBroken)
      .map(async (word) => {
        const downloadedImageUrl = await downloadImageToLocal(word);

        if (downloadedImageUrl) {
          word.imageUrl = word.imageUrlBroken;
          word.imageUrlBroken = undefined;
        } else {
          console.log("No downloaded image url for word:" + word.word);
        }

        fs.writeFileSync("./words.json", JSON.stringify(words, null, 4), () => {
          console.log("Images downloaded to local succesfully!");
        });
      })
  );
};

const downloadImageToLocal = async (word, isSecondAttempt) => {
  const targetPath = `${__dirname}/public/img/guessable/${word.word}.jpg`;

  if (fs.existsSync(targetPath)) {
    // console.log("Skipping download for word: " + word.word);

    return targetPath;
  }

  console.log("Beginning download for word: " + word.word);

  const options = {
    url: isSecondAttempt ? word.rawResponse?.[2]?.url : word.imageUrlBroken,
    dest: targetPath,
  };

  try {
    console.log((isSecondAttempt ? "(2x)" : "") + "Attempting download for word: " + word.word);

    await download.image(options);

    console.log("Downloaded image for word: " + word.word);
    return targetPath;
  } catch (e) {
    if (isSecondAttempt) {
      console.log("Could not download image for word: " + word.word);
      return null;
    } else {
      downloadImageToLocal(word, true);
    }
  }
};

function updateImageForWord(word) {
  return new Promise((resolve, reject) => {
    //thezingcollection2
    // googleClient = new ImagesClient('012529666448905206368:ldg-wfa5wmc', 'AIzaSyBfbAdPTjdFBPN_04wp1ef5l31PTgzFl7A');
    // googleClient = new ImagesClient('012529666448905206368:ldg-wfa5wmc', 'AIzaSyCZiHDBCcIzdqKa1SL0XBlxtUUcf_VqO-c');

    //iuliuvisovan
    googleClient = new ImagesClient("007960637259156093421:jn6qog3skvm", "AIzaSyBfucJbnA_QUnXMEdZf7yZv1fOpFF7Iyw4");

    //lamaieeee
    // googleClient = new ImagesClient("016970297345844598714:yudpwuyp-yq", "AIzaSyAjoJ0G13cV1SKfZTT0M2OwxVmkVRVWigk");

    googleClient
      .search(word.word)
      .then((images) => {
        let imageUrl = "";
        images
          .sort((a, b) => (a.size < b.size ? 1 : -1))
          .forEach((image) => {
            if (image.height > 250 && !image.url.includes("pixabay")) {
              imageUrl = image.url;
              return;
            }
          });
        word.imageUrl = imageUrl;
        word.rawResponse = images;

        console.log("Succesfully updated image for word: " + word.word);

        resolve();
      })
      .catch((err) => console.dir(err));
  });
}
