(function (exports) {
    exports.isLevenshteinMatch = function (guessedValue, correctValue) {
        var isMatch = false;
        var guessedWords = guessedValue.split(" "); //Check individual words
        guessedWords.push(guessedValue); //Also check the entire word
        guessedWords.forEach((s1) => {
            var longer = s1;
            var shorter = correctValue;
            if (s1.length < correctValue.length) {
                longer = correctValue;
                shorter = s1;
            }
            var longerLength = longer.length;
            if (longerLength == 0) {
                return 1.0;
            }
            if (((longerLength - editDistance(longer, shorter)) / parseFloat(longerLength)) > 0.7)
                isMatch = true;
        });
        return isMatch;

        function editDistance(s1, s2) {
            s1 = s1.toLowerCase().trim();
            s2 = s2.toLowerCase().trim();

            var costs = new Array();
            for (var i = 0; i <= s1.length; i++) {
                var lastValue = i;
                for (var j = 0; j <= s2.length; j++) {
                    if (i == 0)
                        costs[j] = j;
                    else {
                        if (j > 0) {
                            var newValue = costs[j - 1];
                            if (s1.charAt(i - 1) != s2.charAt(j - 1))
                                newValue = Math.min(Math.min(newValue, lastValue),
                                    costs[j]) + 1;
                            costs[j - 1] = lastValue;
                            lastValue = newValue;
                        }
                    }
                }
                if (i > 0)
                    costs[s2.length] = lastValue;
            }
            return costs[s2.length];
        }
    }
})(typeof exports === 'undefined' ? this['stringMatcher'] = {} : exports);