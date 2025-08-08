const chalk = require('chalk');

function getTimestamp() {
  return chalk.gray(
    `[${new Date().toLocaleString('fr-BE', {
      timeZone: 'Europe/Brussels',
      hour12: false,
    })}]`
  );
}

const Logger = {
  info: (msg) => {
    console.log(
      `${getTimestamp()} ${chalk.bgBlue.black(' INFO ')} ${chalk.blue(msg)}`
    );
  },
  success: (msg) => {
    console.log(
      `${getTimestamp()} ${chalk.bgGreen.black(' OK ')} ${chalk.green(msg)}`
    );
  },
  warn: (msg) => {
    console.log(
      `${getTimestamp()} ${chalk.bgYellow.black(' WARN ')} ${chalk.yellow(msg)}`
    );
  },
  error: (msg) => {
    console.log(
      `${getTimestamp()} ${chalk.bgRed.black(' ERROR ')} ${chalk.red(msg)}`
    );
  },
  debug: (msg) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `${getTimestamp()} ${chalk.bgMagenta.black(' DEBUG ')} ${chalk.magenta(
          msg
        )}`
      );
    }
  },
};

module.exports = Logger;
