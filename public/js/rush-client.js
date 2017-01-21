var socket;
var manager;

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

    self.Winner = ko.observable('');

    self.Answer = function () {
        socket.emit('answerPush', self.CurrentAnswer());
        self.CurrentAnswer('');
    }

    self.Go = function () {
        socket.on('questionArrived', (question) => {
            self.CurrentQuestion(JSON.parse(question).question);
            self.CurrentPlayerScore(JSON.parse(question).currentPlayerScore);
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
            self.Winner(winner);
            self.End();
        });
    }
}