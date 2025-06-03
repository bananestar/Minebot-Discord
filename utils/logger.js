const chalk = require('chalk');

const Logger = {
  info: (msg) => {
    console.log(`${chalk.bgBlue.black(' INFO ')} ${chalk.blue(msg)}`);
  },
  success: (msg) => {
    console.log(`${chalk.bgGreen.black(' OK ')} ${chalk.green(msg)}`);
  },
  warn: (msg) => {
    console.log(`${chalk.bgYellow.black(' WARN ')} ${chalk.yellow(msg)}`);
  },
  error: (msg) => {
    console.log(`${chalk.bgRed.black(' ERROR ')} ${chalk.red(msg)}`);
  },
  debug: (msg) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`${chalk.bgMagenta.black(' DEBUG ')} ${chalk.magenta(msg)}`);
    }
  },
};

module.exports = Logger;
