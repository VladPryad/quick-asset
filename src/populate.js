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
import _ from "lodash";
const R = require('ramda');

const { BigNumber } = require('bignumber.js');

import { fundAccount } from "./issue.js";

const validSeed = seed => StrKey.isValidEd25519SecretSeed(seed);

const Horizon = initHorizon();

const FEE_PRICE = '2.5';
const FEE_PRICE_STEP = '0.1';
const FEE_VOLUME_START = '0.2';
const FEE_ITERATION = 2; // 75

const changeTrust = async (trustor, asset, fee, trustorAsset = undefined) => {
    if (asset.code == "XLM") return;

    console.log("Allowing trust on " + asset.code);

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
        console.log(`[${trustorAsset.code}] to [${asset.code}] ERROR IN TRUSTLINE CREATION: `, e.response.data.extras ? e.response.data.extras : e.response.data);
    }
};

const initiatedAssets = [];

export async function initAsset(asset) {
    const existingAsset = _.find(initiatedAssets, el => el.asset.code == asset.code);
    if ( existingAsset ) return existingAsset;

    //console.log(initiatedAssets)

    if (asset.code != "XLM") {
        if( !asset.issuer) {
            console.log(`No issuer for ${asset.code}, using random.`)
            asset.issuer = Keypair.random();
        } else if (!validSeed(asset.issuer)) {
            console.log(`Invalid issuer for ${asset.code}, using random.`)
            asset.issuer = Keypair.random();
        } else {
            asset.issuer = Keypair.fromSecret(asset.issuer); 
        }
    } else {
        asset.issuer = null;
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

    console.log("Checking if accounts exist...");

    if ( asset.code != "XLM" && !(await accountExists(asset.issuer))) await fundAccount(asset.issuer);
    if ( !(await accountExists(asset.distributor))) await fundAccount(asset.distributor);

    if (asset.code  == "XLM") {
        asset.asset = Asset.native();
    } else {
        asset.asset = new Asset(asset.code, asset.issuer.publicKey());
    }

    initiatedAssets.push(asset);

    return asset;
}

async function preparePairs(raw) {
    if (!raw.single) raw.single = [];
    if (!raw.cross) raw.cross = [];

    const fee = await Horizon.fetchBaseFee();
    function makePairs(arr) {
        var res = [],
            l = arr.length;
        for(var i=0; i<l; ++i)
            for(var j=i+1; j<l; ++j)
                res.push([arr[i], arr[j]]);
        return res;
    }
    const crossPairsSequential = makePairs(raw.cross);
    const rawPairs = [
    ...raw.single,
    ...crossPairsSequential.map(el => ({buying: el[0], selling: el[1] })),
    ...crossPairsSequential.map(el => ({buying: el[1], selling: el[0] })) ];

    const assets = _.uniqBy(rawPairs.flatMap(el => [el.selling, el.buying]), el => el.code + el.issuer + el.distributor);

    function createAsset(asset) {
        return new Promise(async (res, rej) => {
            const created = await initAsset(asset);
            res(created);
        })
    }

    function changeTrustlines(pair) {
        return new Promise(async (res, rej) => {

            console.log(`Checking trustlines between ${pair.buying.asset.code} and ${pair.selling.asset.code} ...`);
            // if (!(await checkTrustline(pair.buying.distributor, pair.selling.asset))) {
            //     console.log(`No trust between ${pair.buying.asset.code} distributor and ${pair.selling.asset.code}`)
            //     await changeTrust(pair.buying.distributor, pair.selling.asset, fee);
            // }
            if (!(await checkTrustline(pair.selling.distributor, pair.buying.asset))) {
                console.log(`No trust between ${pair.selling.asset.code} distributor and ${pair.buying.asset.code}`)
                await changeTrust(pair.selling.distributor, pair.buying.asset, fee, pair.selling.asset);
            }
            res(true);
        })
    }

    const promises = assets.map(createAsset);

    return Promise.all(promises)
    .then((createdAssets) => 
    {
        return rawPairs.map(el => {
            return {
                selling: _.find(createdAssets, asset => el.selling.code == asset.code),
                buying: _.find(createdAssets, asset => el.buying.code == asset.code)
            }
        })
    })
    .then(pairs => {
        console.log("PAIRS: ", pairs.map(el => {
            try {
                el.buying.issuer = el.buying.issuer == null ? "xlm" : el.buying.issuer.publicKey();
                el.selling.issuer = el.selling.issuer == null ? "xlm" : el.selling.issuer.publicKey();
            } catch(e) {

            }
            return {
                buy: el.buying.code + " " + el.buying.issuer + " " + el.buying.distributor.publicKey(),
                sell: el.selling.code + " " + el.selling.issuer + " " + el.selling.distributor.publicKey(),
            };
        }))
        const promisesTrust = pairs.map(changeTrustlines);
        return Promise.all(promisesTrust)
        .then(() => pairs);
    })
}

async function accountExists(acc) {
    try {
        await Horizon.loadAccount(acc.publicKey());
    } catch(e) {
        if( e.response.status === 404 ) return false;
        console.log("ERROR IN ACCOUNT CHECK: ", e);
    }

    return true;
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

        console.log(`[${buying.asset.code}/${selling.asset.code}] Submitting transaction for price: ${offer.price} & volume: ${offer.volume}`)

        try {
            await Horizon.submitTransaction(transaction);
        } catch(e) {
            console.log(`[${buying.asset.code}/${selling.asset.code}] ERROR IN OFFER CREATION: `, e.response.data.extras ? e.response.data.extras : e.response.data);
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

const checkTrustline = async (acc, asset) => {
    const account = await Horizon.loadAccount(acc.publicKey());
    return !!_.find(account.balances, el => el.asset_code == asset.code && el.asset_issuer == asset.issuer);
}

async function populatePair(asset1, asset2) {
    const fee = await Horizon.fetchBaseFee();

    console.log(`Populating pair ${asset1.asset.code} and ${asset2.asset.code}`)

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
    console.log("Preparing pairs...");
    const pairs = await preparePairs(getPairs());

    const promises = pairs.map(el => populatePair(el.buying, el.selling))
      
    for (let promise of promises) callTasks(promise);
}
