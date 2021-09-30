import fs from 'fs';
import path, { dirname } from 'path';
import { CREDS_FILE } from '../../config.js';

const __dirname = path.resolve(dirname(''));


export default function saveCreds(asset) {
    const payload =
    `ASSET_CODE=${asset.code} \r\n\
ASSET_ISSUER_PUBLIC=${asset.issuer && asset.issuer.publicKey()} \r\n\
ASSET_ISSUER_SECRET=${asset.issuer && asset.issuer.secret()} \r\n\
ASSET_DISTRIBUTOR_PUBLIC=${asset.distributor.publicKey()} \r\n\
ASSET_DISTRIBUTOR_SECRET=${asset.distributor.secret()}\r\n\r\n`

    fs.appendFileSync(path.join(__dirname, CREDS_FILE), payload)
}