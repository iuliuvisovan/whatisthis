var socket;
var manager;
var currentAnswerTimeout;

$(document).ready(() => {
    manager = new RushManager();
    ko.applyBindings(manager);
    manager.Init();
});

var RushManager = function () {
    var self = this;
    self.Players = ko.observableArray();
    self.CurrentPlayerName = ko.observable('');
    self.CurrentPlayerScore = ko.observable(0);

    self.CurrentPlayerName.subscribe(newValue => {
        localStorage.setItem('currentPlayerName', newValue);
        socket.emit('playerUpdated', JSON.stringify({
            name: self.CurrentPlayerName(),
            score: self.CurrentPlayerScore(),
        }));
    });

    self.IsStarted = ko.observable(false);
    self.Loading = ko.observable(false);
    self.CurrentQuestion = ko.observable('');
    self.CurrentAnswer = ko.observable('');
    self.CurrentCorrectAnswer = ko.observable('');
    self.CurrentCorrectAnswerHidden = '';
    self.LoadingNextImage = ko.observable(true);
    self.SomeoneRageQuit = ko.observable(false);
    self.CountDownSeconds = ko.observable(3);

    self.Winner = ko.observable('');

    self.SendAnswer = function (forced) {
        if (self.LoadingNextImage() && !forced)
            return;
        if (!self.CurrentAnswer().length && !forced)
            return;
        self.LoadingNextImage(true);
        socket.emit('answerPush', self.CurrentAnswer());
        if (!forced && self.CurrentAnswer().trim().toLowerCase() != self.CurrentCorrectAnswerHidden.trim().toLowerCase()) {
            self.CurrentCorrectAnswer(self.CurrentCorrectAnswerHidden);
            currentAnswerTimeout && clearTimeout(currentAnswerTimeout);
            currentAnswerTimeout = setTimeout(() => {
                self.CurrentCorrectAnswer('');
            }, 2000);
        }
        self.CurrentAnswer('');
    }


    self.Go = function () {
        socket.on('questionArrived', (question) => {
            self.CurrentQuestion(JSON.parse(question).question);

            self.CurrentCorrectAnswerHidden = JSON.parse(question).answer;
            self.CurrentPlayerScore(JSON.parse(question).currentPlayerScore);
            $(".question-image").ready();
            var photo = document.getElementById('questionImage');
            var img = new Image();
            img.addEventListener('load', () => {
                self.LoadingNextImage(false);
                setTimeout(() => {
                    if ($(".question-image").width() > $(window).width())
                        $(".question-image").css('margin-left', ($(window).width() - $(".question-image").width()) / 2)
                }, 500);
            }, false);
            img.addEventListener('error', () => {
                self.SendAnswer(true);
            }, false);
            img.src = JSON.parse(question).question;
            photo.src = img.src;
        });
        socket.emit('go');
        self.Loading(true);
        self.IsStarted(true);
        var firstOne = new Audio('/audio/first.mp3');
        firstOne.loop = false;
        firstOne.play();
        var intervalCountdownSound = setInterval(() => {
            self.CountDownSeconds(self.CountDownSeconds() - 1);
            let first = new Audio('/audio/first.mp3');
            first.loop = false;
            first.play();
        }, 1000);
        setTimeout(() => {
            clearInterval(intervalCountdownSound);
            self.Loading(false);
            self.CountDownSeconds(3);
        }, 3000);
    }

    self.Interrupt = function () {
        self.IsStarted(false);
        self.Loading(false);
        self.LoadingNextImage(false);
        self.SomeoneRageQuit(true);
    }

    self.End = function () {
        self.IsStarted(false);
    }

    self.Init = () => {
        socket = io();
        socket.on('playerlistupdate', players => {
            self.Players(JSON.parse(players).filter(x => x.id != socket.id));
        });
        socket.on('playermissed', playerId => {
            setTimeout(() => {
                $(`[data-playerId="${playerId}"]`).addClass('missed');
            }, 0);
            setTimeout(() => {
                $(`[data-playerId="${playerId}"]`).removeClass('missed');
            }, 2500);
        });
        socket.on('go', () => {
            !self.IsStarted() && self.Go();
        });
        socket.on('interrupt', () => {
            self.Interrupt();
        });
        socket.on('end', winner => {
            self.CurrentPlayerScore(self.CurrentPlayerScore() + 1);
            setTimeout(() => {
                self.End();
                self.Winner(winner);
            }, 500);
        });
        var savedName = localStorage.getItem('currentPlayerName');
        if (savedName && savedName.length) {
            self.CurrentPlayerName(savedName);
        }
    }
}