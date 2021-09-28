import { getConfig, getAssets, getPairs } from "./config.js";
import {
    TransactionBuilder,
    Networks,
    Operation,
    Asset,
    FederationServer,
    StrKey,
    Keypair,
    Server
} from 'stellar-sdk';
import {
    PUBLIC_HORIZON_URL,
    TEST_HORIZON_URL,
    TEST_HORIZON_PASSPHRASE
 } from "../config.js";

import saveCreds from "./helpers/saveCreds.js";
import { initHorizon } from "./helpers/horizon.js";

const _ = require('lodash');
const { BigNumber } = require('bignumber.js');

import { fundAccount } from "./issue.js";

const validSeed = seed => StrKey.isValidEd25519SecretSeed(seed);

const Horizon = initHorizon();

const FEE_PRICE = '2.5';
const FEE_PRICE_STEP = '0.1';
const FEE_VOLUME_START = '0.2';
const FEE_ITERATION = 2; // 75

const changeTrust = async (trustor, asset, fee) => {

    const account = await Horizon.loadAccount(trustor.publicKey());

    const transaction = new TransactionBuilder(account, { fee, networkPassphrase: TEST_HORIZON_PASSPHRASE }) // TODO: Use other nets, encapsulate TransBuilder
        .addOperation(Operation.changeTrust({
            asset,
        }))
        .setTimeout(30)
        .build();

    transaction.sign(trustor);

    try {
        await Horizon.submitTransaction(transaction);
    } catch(e) {
        console.log("ERROR IN TRUSTLINE CREATION: ", e.response.data.extras);
    }
};

export async function initAsset(asset) {
    if( !asset.issuer) {
        console.log(`No issuer for ${asset.code}, using random.`)
        asset.issuer = Keypair.random();
    } else if (!validSeed(asset.issuer)) {
        console.log(`Invalid issuer for ${asset.code}, using random.`)
        asset.issuer = Keypair.random();
    } else {
        asset.issuer = Keypair.fromSecret(asset.issuer); 
    }

    if( !asset.distributor) {
        console.log(`No distributor for ${asset.code}, using random.`)
        asset.distributor = Keypair.random();
    } else if (!validSeed(asset.distributor)) {
        console.log(`Invalid distributor for ${asset.code}, using random.`)
        asset.distributor = Keypair.random();
    } else {
        asset.distributor = Keypair.fromSecret(asset.distributor); 
    }

    // TODO: not fund account if it exists
    //await fundAccount(asset.issuer); // TODO: Only for testnet, no need to fund existing accounts
    //await fundAccount(asset.distributor); // TODO: Only for testnet

    asset.asset = new Asset(asset.code, asset.issuer.publicKey());

    return asset;
}

async function preparePairs(raw) {
    const pairs = [];
    function createPair(pair) {
        return new Promise(async (res, rej) => {
            const buying = await initAsset(pair.buying);
            const selling = await initAsset(pair.selling);
            pairs.push({
                buying,
                selling,
            })
            pairs.push({
                buying: selling,
                selling: buying,
            })
            res(true);
        })
    }
    const promises = raw.single.map(createPair)
    return Promise.all(promises)
    .then(() => pairs);
}

 const prepareOrderbook = async (fee, buying, selling) => {
    const manageOffer = async (offers) => {
        const offer = offers.shift();

        const account = await Horizon.loadAccount(selling.distributor.publicKey());

        const transaction = new TransactionBuilder(account, { fee, networkPassphrase: TEST_HORIZON_PASSPHRASE })
            .addOperation(Operation.manageSellOffer({
                selling: selling.asset,
                buying: buying.asset,
                amount: offer.volume,
                price: offer.price,
            }))
            .setTimeout(30)
            .build();

        transaction.sign(selling.distributor);

        console.log(`Submitting transaction for price: ${offer.price} & volume: ${offer.volume}`)

        try {
            await Horizon.submitTransaction(transaction);
        } catch(e) {
            console.log("ERROR IN OFFER CREATION: ", e.response.data.extras);
        }

        if (!_.isEmpty(offers)) {
            return manageOffer(offers);
        }

        return true;
    };

    const prices = _.map(_.range(0, FEE_ITERATION), i => new BigNumber(FEE_PRICE).plus(new BigNumber(FEE_PRICE_STEP).times(new BigNumber(i))).toPrecision(7));
    const volumes = [FEE_VOLUME_START];
    for (var i = 1; i < FEE_ITERATION; i++) {
        volumes.push(new BigNumber(volumes[i - 1]).times(new BigNumber('1.25')).toPrecision(7));
    }

    const orders = _.zipWith(prices, volumes, (price, volume) => ({ price, volume }));

    return manageOffer(orders);
};

async function populatePair(asset1, asset2) {
    const fee = await Horizon.fetchBaseFee();
    console.log('FEE: ', fee);

    prepareOrderbook(fee, asset1, asset2);
}

export async function populate() {
    const fee = await Horizon.fetchBaseFee();

    async function* callTasks(promises) {
        for(const promise of promises) {
          yield await promise;
        }
    };

    console.log("========== POPULATING ==========");
    console.log("[] Preparing pairs...");
    const pairs = await preparePairs(getPairs());

    // TODO: dont create trustlines if they exist

    // console.log("[] Changing trustlines...");

    // const trustlinePromises = pairs.map(el => {
    //     changeTrust(el.selling.distributor, el.buying.asset, fee);
    // });

    // for (let promise of trustlinePromises) callTasks(promise);

    const promises = pairs.map(el => populatePair(el.buying, el.selling))
      
    for (let promise of promises) callTasks(promise);
}
