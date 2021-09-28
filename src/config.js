import YAML from 'yaml'
import fs from 'fs'
import path, { dirname } from 'path';
import _ from 'lodash';


import {
    STELLAR_CONFIG_FILENAME,
    ASSET_CONFIG_FILENAME
 } from '../config.js';

const __dirname = path.resolve(dirname(''));

const configFile = fs.readFileSync( path.join(__dirname, STELLAR_CONFIG_FILENAME) , 'utf8')
const config = YAML.parse(configFile);

const assetsFile = fs.readFileSync( path.join(__dirname, ASSET_CONFIG_FILENAME) , 'utf8')
const assets = YAML.parse(assetsFile);

export function getConfig(name) {
    if (!name) return config;
    return config[name];
}

export function getAssets(code) {
    if (!code) return assets.assets;

    if(!_.find(assets.assets, asset => asset.code === code)) throw new Error("No such asset in assetfile!");

    const matches = _.filter(assets.assets, asset => asset.code === code);

    if (matches[1]) return matches;

    return matches[0];
}

export function getPairs() {
    return assets.pairs;
}