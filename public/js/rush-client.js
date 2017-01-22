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

    self.CurrentPlayerName.subscribe(newValue => socket.emit('playerUpdated', JSON.stringify({
        name: self.CurrentPlayerName(),
        score: self.CurrentPlayerScore(),
    })));

    self.IsStarted = ko.observable(false);
    self.Loading = ko.observable(false);
    self.CurrentQuestion = ko.observable('');
    self.CurrentAnswer = ko.observable('');
    self.CurrentCorrectAnswer = ko.observable('');
    self.CurrentCorrectAnswerHidden = '';
    self.LoadingNextImage = ko.observable(false);
    self.SomeoneRageQuit = ko.observable(false);

    self.Winner = ko.observable('');

    self.SendAnswer = function () {
        self.LoadingNextImage(true);
        socket.emit('answerPush', self.CurrentAnswer());
        if (self.CurrentAnswer().trim().toLowerCase() != self.CurrentCorrectAnswerHidden.trim().toLowerCase()) {
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
            self.LoadingNextImage(false);
        });
        socket.emit('go');
        self.Loading(true);
        self.IsStarted(true);
        setTimeout(() => {
            self.Loading(false);
        }, 2000);
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
    }
}