var config = require('./lib/config');
var logger = require('./lib/logger');
var TorInstance = require('./lib/torinstance');
var fs = require('fs');
var crypto = require('crypto');
var express = require('express');
var uuid = require('uuid/v4');

if (!fs.existsSync('logs')) fs.mkdirSync('logs');
if (!fs.existsSync('private')) fs.mkdirSync('private');
if (!fs.existsSync('data')) fs.mkdirSync('data');

var gitCommit = 'unknown';
try {
    gitCommit = fs.readFileSync('.git/refs/heads/master', { encoding: 'utf8' }).substr(0, 8);
} catch (e) {}

logger.info(`hsman git-${gitCommit} running on ${process.platform}.`);

if (process.platform === 'linux') {
    try {
        logger.info(spawnSync('uname', ['-a']).stdout.toString().trim());
    } catch (e) { }
}
config = config.getConfig();

logger.info('Starting...');

var authCookie = crypto.randomBytes(24).toString('hex');

fs.writeFileSync(`auth_cookie.txt`, authCookie, { mode: 0o700 });