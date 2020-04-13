var fs = require('fs');
var logger = require('./logger');

var read = function (fn, defaultValue) {
    if (!fs.existsSync(fn)) return defaultValue;
    return fs.readFileSync(fn, { encoding: 'utf8' });
}
var write = function (fn, value) {
    logger.debug(`Write to file ${fn}`);
    return fs.writeFileSync(fn, value != null ? value.toString() : 'null', { encoding: 'utf8' });
}
var writeToInstance = function (instanceName, key, value) {
    if (!fs.existsSync(`data/${instanceName}`)) fs.mkdirSync(`data/${instanceName}`, 0o700);
    return write(`data/${instanceName}/${key}`, value);
}
var writeToInstanceMultiple = function (instanceName, keys) {
    for (var k in keys) {
        writeToInstance(instanceName, k, keys[k]);
    }
}
var readFromInstance = function (instanceName, key) {
    if (!fs.existsSync(`data/${instanceName}`)) fs.mkdirSync(`data/${instanceName}`, 0o700);
    return read(`data/${instanceName}/${key}`);
}
var deleteFolderRecursive = function (path) {
    logger.debug(`Delete file/dir ${path}`);
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function (file, index) {
            var curPath = path + '/' + file;
            if (fs.lstatSync(curPath).isDirectory()) {
                deleteFolderRecursive(curPath);
            } else {
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
}
module.exports = {
    read, write, writeToInstance, writeToInstanceMultiple, readFromInstance, deleteFolderRecursive,
}