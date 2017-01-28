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
    self.ExtraPlayersCount = ko.observable();
    self.CurrentPlayerName = ko.observable('');
    self.CurrentPlayerScore = ko.observable(0);

    self.CurrentPlayerName.subscribe(newValue => {
        localStorage.setItem('currentPlayerName', newValue);
        socket.emit('playerUpdated', JSON.stringify({
            name: self.CurrentPlayerName(),
            score: self.CurrentPlayerScore(),
            winCount: self.CurrentPlayerWinCount()
        }));
    });

    self.IsStarted = ko.observable(false);
    self.Loading = ko.observable(false);
    self.CurrentQuestion = ko.observable('');
    self.CurrentAnswer = ko.observable('');
    self.CurrentCorrectAnswer = ko.observable('');
    self.CurrentPlayerWinCount = ko.observable(0);
    self.CurrentPlayerWinCount.subscribe(newValue => {
        sessionStorage.setItem('winCount', newValue);
    });
    self.CurrentCorrectAnswerHidden = '';
    self.PrecachedImages = ko.observableArray();

    self.LoadingNextImage = ko.observable(true);
    self.SomeoneRageQuit = ko.observable(false);
    self.CountDownSeconds = ko.observable(3);

    self.WinnerName = ko.observable('');
    self.WinnerId = ko.observable('');
    self.IsWinnerCurrentPlayer = ko.pureComputed(() => {
        return self.WinnerId() == (socket && socket.id);
    });

    self.SendAnswer = function (forced) {
        if (self.LoadingNextImage() && !forced)
            return;
        if (!self.CurrentAnswer().length && !forced)
            return;
        self.LoadingNextImage(true);
        socket.emit('answerPush', self.CurrentAnswer());
        if (!forced && !stringMatcher.isLevenshteinMatch(self.CurrentAnswer(), self.CurrentCorrectAnswerHidden)) {
            self.CurrentCorrectAnswer(self.CurrentCorrectAnswerHidden);
            currentAnswerTimeout && clearTimeout(currentAnswerTimeout);
            currentAnswerTimeout = setTimeout(() => {
                self.CurrentCorrectAnswer('');
            }, 2000);
        }
        self.CurrentAnswer('');
    }


    self.Go = function () {
        socket.emit('go');
        ga('send', 'event', 'Game', 'action', 'play');

        self.WinnerName('');
        self.WinnerId('');
        self.CurrentPlayerScore(0);
        self.CurrentAnswer('');
        self.SomeoneRageQuit(false);
        self.LoadingNextImage(false);
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
            setTimeout(() => {
                $("#inputCurrentAnswer").focus();
            }, 150);
        }, 3000);
    }

    self.Interrupt = function () {
        ga('send', 'event', 'Game', 'action', 'interrupt');
        self.IsStarted(false);
        self.Loading(false);
        self.LoadingNextImage(false);
        self.SomeoneRageQuit(true);
    }

    self.End = function () {
        ga('send', 'event', 'Game', 'action', 'end');
        self.IsStarted(false);
    }

    self.Init = () => {
        socket = io();
        var savedName = localStorage.getItem('currentPlayerName');
        if (savedName && savedName.length) {
            self.CurrentPlayerName(savedName);
            ga('send', 'event', 'Game', 'playerRejoin', savedName);
        }
        var savedWinCount = sessionStorage.getItem('winCount');
        if (savedWinCount && savedWinCount.length) {
            self.CurrentPlayerWinCount(savedWinCount);
            socket.emit('playerUpdated', JSON.stringify({
                name: self.CurrentPlayerName(),
                score: self.CurrentPlayerScore(),
                winCount: self.CurrentPlayerWinCount()
            }));
        }

        socket.on('playerlistupdate', players => {
            var allPlayers = (JSON.parse(players).filter(x => x.id != socket.id));
            var maxPlayerCount = (window.innerWidth < 1024) ? 3 : 10;
            var criteria = self.IsStarted() ? "score" : "winCount";
            var remainingPlayers = allPlayers.sort((a, b) => a[criteria] > b[criteria] ? -1 : 1).slice(0, maxPlayerCount);
            self.ExtraPlayersCount(allPlayers.length - maxPlayerCount);
            self.Players(remainingPlayers);
            var currentPlayerWinCount = JSON.parse(players).find(x => x.id == socket.id).winCount;
            if (currentPlayerWinCount < 1) {
                var savedWinCount = sessionStorage.getItem('winCount');
                if (savedWinCount && savedWinCount.length) {
                    self.CurrentPlayerWinCount(savedWinCount);
                    socket.emit('playerUpdated', JSON.stringify({
                        name: self.CurrentPlayerName(),
                        score: self.CurrentPlayerScore(),
                        winCount: self.CurrentPlayerWinCount()
                    }));
                }
            } else {
                self.CurrentPlayerWinCount(currentPlayerWinCount);
            }
        });
        socket.on('playermissed', (playerDataJson) => {
            var playerData = JSON.parse(playerDataJson);
            setTimeout(() => {
                $(`[data-playerId="${playerData.playerId}"]`).removeClass('missed');
                $(`[data-playerId="${playerData.playerId}"]`).addClass('missed');
                $(`[data-playerId="${playerData.playerId}"]`).attr('data-lastmissedword', playerData.playerMissedWord);
            }, 0);
        });
        socket.on('imagesPrecache', (images) => {
            self.PrecachedImages(JSON.parse(images));
        });
        socket.on('questionArrived', (question) => {
            self.CurrentQuestion(JSON.parse(question).question);

            self.CurrentCorrectAnswerHidden = JSON.parse(question).answer;
            self.CurrentPlayerScore(JSON.parse(question).currentPlayerScore);
            $(".question-image").ready();
            var photo = document.getElementById('questionImage');
            var img = new Image();
            img.addEventListener('load', () => {
                self.LoadingNextImage(false);
            }, false);
            img.addEventListener('error', () => {
                self.SendAnswer(true);
            }, false);
            img.src = JSON.parse(question).question;
            photo.src = img.src;
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
                self.WinnerName(JSON.parse(winner).name);
                self.WinnerId(JSON.parse(winner).id);
            }, 500);
        });
    }
}

ko.components.register('player-list', {
    viewModel: function (params) {
        this.Players = params.Players;
        this.ExtraPlayersCount = params.ExtraPlayersCount;
    },
    template: `
          <div style="text-align: center">
            <div data-bind="foreach: Players().sort((a,b) => { return a.winCount > b.winCount ? -1 : 1 }).slice(0,3)">
                <div class="player">
                    <i class="player-win-count" style="color: #FF5722">
                        <span>wins: </span>
                        <b data-bind="text: winCount"></b>
                    </i>
                    <span data-bind="text: name" class="player-name"></span>
                </div>
            </div>
            <i style="font-size: 12px" data-bind="visible: !Players().length">Looks like nobody's here..</i>
            <i style="font-size: 12px" data-bind="visible: Players().length > 3">
                +<span data-bind="text: ExtraPlayersCount() + (Players().length - 3)">0</span>
                <span> other player</span><span data-bind="visible: Players().length > 4">s</span>
            </i>
        </div>
        `
});