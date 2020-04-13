var fs = require('fs');
var { writeToInstanceMultiple, write, read, readFromInstance, deleteFolderRecursive, writeToInstance } = require('./files');
var { spawn, ChildProcess } = require('child_process');
var { textToRC, RCToText } = require('./RC');
var isRunning = require('is-running');
var logger = require('./logger');
var { resolve } = require('path');
var config = require('./config').getConfig();

var _instances = {};

module.exports = class TorInstance {
    constructor(name, port) {
        if (TorInstance.instances[name]) throw new Error(`instance of ${name} already instantiated.`);
        TorInstance.instances[name] = this;
        this.name = name;
        this.port = port;
        this.isRunning = false;
        this.isReady = false;
        this.log = '';
        if (!fs.existsSync(`data/${name}`)) {
            writeToInstanceMultiple(name, {
                name,
                port,
                created: Date.now(),
                rc: TorInstance.getTemplate(this.name, this.port),
            });
        } else {
            this.updateStatus();
        }
    }
    updateStatus() {
        this.isRunning = fs.existsSync(`data/${this.name}/pid`) && isRunning(Number(read(`data/${this.name}/pid`)));
        if (this.isRunning) {
            this.isReady = true;
        }
    }
    serialize() {
        this.updateStatus();
        var isHiddenService = !!this.getRC().HiddenServiceDir;
        var props = {
            name: this.name,
            torProcessStatus: this.isRunning ? 'running' : 'dead',
            isHiddenService,
        };
        if (isHiddenService) {
            try {
                var mhs = readFromInstance(this.name, 'multiple_hs');
                if (mhs != null) {
                    props.hostname = [];
                    for (var i = 0; i < Number(mhs); i++) {
                        try {
                            props.hostname.push(fs.readFileSync(`data/${this.name}/hs_${i}/hostname`, { encoding: 'utf8' }).trim());
                        } catch (e) { props.hostname.push('CouldNotReadHostname'); }
                    }
                } else {
                    props.hostname = readFromInstance(this.name, 'hostname').trim();
                }
            } catch (e) {
                props.hostname = null;
                props.internalError = e.message;
            }
        }
        return props;
    }
    restart() {
        if (this.shutdown()) {
            this.run();
        }
    }
    shutdown() {
        if (!fs.existsSync(`data/${this.name}/pid`) || !isRunning(Number(read(`data/${this.name}/pid`)))) {
            return false;
        }
        try { process.kill(Number(read(`data/${this.name}/pid`))); } catch (e) { }
        try { if (this.vanguards) this.vanguards.kill(); } catch (e) { }
        try { fs.unlinkSync(`data/${this.name}/pid`); } catch (e) { }
        return true;
    }
    getProxy() {
        var rc = this.getRC();
        if (!rc || !rc.SocksPort) return null;
        return `:::${rc.SocksPort}`;
    }
    run(force = false) {
        if (fs.existsSync(`data/${this.name}/pid`) && isRunning(Number(read(`data/${this.name}/pid`))) && !force) return false;
        this.process = spawn(process.platform === 'linux' ? 'tor' : './tor/tor', ['-f', `./data/${this.name}/rc`], {
            cwd: ``,
        });
        this.process.stdout.on('data', c => {
            if (!this.isReady && c.toString().match('Bootstrapped 100%')) {
                this.isReady = true;
            }
        });
        logger.info(`Tor instance ${this.name} is now running.`);
        var port = this.getRC('ControlPort');
        if (config.pool.vanguards.enabled && port) {
            const VANGUARDS_PATH = config.pool.vanguards.cmd[0];
            if (!fs.existsSync(`${VANGUARDS_PATH}`)) {
                logger.warn(`Bad: vanguards not found at ${VANGUARDS_PATH}`);
            } else {
                try {
                    var args = config.pool.vanguards.slice(1).filter(n => n.replace('%control_port%', port));
                    var proc = spawn(resolve(`${VANGUARDS_PATH}`), args, {
                        cwd: '',
                    });
                    proc.stdout.on('data', c => {
                        logger.verbose(c.toString().trim());
                    });
                    this.vanguards = proc;
                } catch (e) {
                    logger.error(e.stack);
                }
            }
        }
        this.isRunning = true;
        return true;
    }
    getRC(name) {
        var rc = textToRC(readFromInstance(this.name, 'rc'));
        if (!rc) return null;
        return name ? rc[name] : rc;
    }
    setHSState(enabled, port, version = '3') {
        if (enabled) {
            this.setRCParams({
                HiddenServiceDir: `data/${this.name}`,
                HiddenServiceVersion: version,
                HiddenServicePort: `80 127.0.0.1:${port}`,
            });
        } else {
            this.setRCParams({
                HiddenServiceDir: null,
                HiddenServiceVersion: null,
                HiddenServicePort: null,
            });
        }
    }
    setHSStateMultiple(port, count, version = '3') {
        var rcText = `${RCToText(this.getRC())}\r\n`;
        for (var i = 0; i < count; i++) {
            fs.mkdirSync(`data/${this.name}/hs_${i}`, 0o700);
            rcText += `
# hs_${i}
HiddenServiceDir data/${this.name}/hs_${i}
HiddenServiceVersion ${version}
HiddenServicePort 80 127.0.0.1:${port}

`;
        }
        writeToInstance(this.name, 'multiple_hs', count);
        writeToInstance(this.name, 'rc', rcText);
    }
    setRCParams(params) {
        var rc = this.getRC();
        for (let param in params) {
            if (rc[param] === null) {
                delete rc[param];
            } else {
                rc[param] = params[param];
            }
        }
        writeToInstance(this.name, 'rc', RCToText(rc));
        return true;
    }
    static get instances() {
        return _instances;
    };
    static getInstance(name) {
        if (fs.existsSync(`data/${name}`)) {
            if (this.instances[name]) return this.instances[name];
            return new TorInstance(name, Number(readFromInstance(name, 'port')));
        }
        return null;
    }
    static deleteInstance(name) {
        deleteFolderRecursive(`data/${name}`);
    }
    static enumerateInstances() {
        var datadir = fs.readdirSync(`data`);
        var d = [];
        for (var instance of datadir) {
            if (instance) {
                var fp = fs.openSync(`data/${instance}`, 'r');
                if (fs.fstatSync(fp).isDirectory()) {
                    d.push(instance);
                }
                fs.closeSync(fp);
            }
        }
        return d;
    }
    static enumerateRCs() {
        return this.enumerateInstances().map(i => textToRC(readFromInstance(i, 'rc')));
    }
    static getAvailableTorPort() {
        var rcs = TorInstance.enumerateRCs();
        for (var i = 9195; i < 9290; i++) {
            if (rcs.findIndex(rc => rc['SocksPort'] === i.toString()) === -1) {
                return i;
            }
        }
        throw new Error('No available ports.');
    }
    static getAvailableTorControlPort() {
        var rcs = TorInstance.enumerateRCs();
        for (var i = 9099; i < 9194; i++) {
            if (rcs.findIndex(rc => rc['ControlPort'] === i.toString()) === -1) {
                return i;
            }
        }
        throw new Error('No available ports.');
    }
    static getTemplate(name, port) {
        return (
            `Log notice file data/${name}/tor.log
Log notice
SocksPort ${port}
AvoidDiskWrites 1
DataDirectory data/${name}/store
CookieAuthentication 1
PidFile data/${name}/pid
ControlPort ${this.getAvailableTorControlPort()}
`);
    }
};