$(document).ready(function () {

  // start with a random number generator(1-109)
  var randomNum = Math.floor(Math.random() * 101 + 19)


  $('#randomNumber').text(randomNum);

  // Setting up random numbers for each crystal (1-12)
  var number1 = Math.floor(Math.random() * 11 + 1)
  var number2 = Math.floor(Math.random() * 11 + 1)
  var number3 = Math.floor(Math.random() * 11 + 1)
  var number4 = Math.floor(Math.random() * 11 + 1)

  // set up initial variable for userScore, wins and losses
  var userScore = 0;
  var wins = 0;
  var losses = 0;

  $('#numberWins').text(wins);
  $('#numberLosses').text(losses);

  //create resets for every win or loss
  function reset() {
    randomNum = Math.floor(Math.random() * 101 + 19);
    console.log(randomNum)
    $('#randomNumber').text(randomNum);
    number1 = Math.floor(Math.random() * 11 + 1);
    number2 = Math.floor(Math.random() * 11 + 1);
    number3 = Math.floor(Math.random() * 11 + 1);
    number4 = Math.floor(Math.random() * 11 + 1);
    userScore = 0;
    $('#finalScore').text(userScore);
  }

  //update the wins to user's current score
  function winDisplay() {
    alert("You won!");
    wins++;
    $('#numberWins').text(wins);
    reset();
  }

  //update the losses to user's current score
  function lossDisplay() {
    alert("You lose!");
    losses++;
    $('#numberLosses').text(losses);
    reset()
  }

  //click button for all kinds of crystal
  $('#one').on('click', function () {
    userScore = userScore + number1;
    console.log("New userScore= " + userScore);
    $('#finalScore').text(userScore);

    //
    if (userScore === randomNum) {
      winDisplay();
    } else if (userScore >= randomNum) {
      lossDisplay();
    }
  })
  $('#two').on('click', function () {
    userScore = userScore + number2;
    console.log("New userScore= " + userScore);
    $('#finalScore').text(userScore);
    if (userScore === randomNum) {
      winDisplay();
    } else if (userScore >= randomNum) {
      lossDisplay();
    }
  })
  $('#three').on('click', function () {
    userScore = userScore + number3;
    console.log("New userScore= " + userScore);
    $('#finalScore').text(userScore);
    //sets win/lose conditions
    if (userScore === randomNum) {
      winDisplay();
    } else if (userScore >= randomNum) {
      lossDisplay();
    }
  })
  $('#four').on('click', function () {
    userScore = userScore + number4;
    console.log("New userScore= " + userScore);
    $('#finalScore').text(userScore);

    if (userScore === randomNum) {
      winDisplay();
    } else if (userScore >= randomNum) {
      lossDisplay();
    }
  });
});
