const clean = require("matcha/lib/matcha/reporters/clean");

function average(list) {
  if (!list.length) {
    return 0;
  }

  const sum = list.reduce((previous, current) => previous + current);
  return (sum / list.length).toFixed(0);
}


// Like clean, but also produces an average:
module.exports = function(runner, utils) {
  const humanize = utils.humanize;
  const padBefore = utils.padBefore;
  const color = utils.color;
  const results = {};
  let currentResults = [];
  runner.on("bench end", benchResults => {
    currentResults.push(benchResults.ops);
  });
  runner.on("suite end", suite => {
    const avg = humanize(average(currentResults));
    console.log(padBefore(avg + " op/s", 22) + " » " + suite.title);
    console.log();
    results[suite.title] = avg;
    currentResults = [];
  });

  runner.on("end", () => {
    for (const k in results) {
      console.log(color(padBefore(k, 30) + ":  ", "gray") + results[k] + " op/s");
    }
    console.log();
  });

  clean(runner, utils);
};
