# quick-asset
Tool for quick asset issuing on Stellar network.
This CLI provides some quick mocking functions for Stellar test network.

You need to create TWO files:
# stellarfile.yaml
Consists of declaration of the network you are using.
Minimum content - one line (if it's test or public network)
`network: test
horizon: https://horizon-testnet.stellar.org
passphrase: Public Global Stellar Network ; September 2015`
# assetfile.yaml
Declares assets, that needs to be created (alphanum12/alphanum4 - does not matter)
`assets:
  - code: Nastya
    issuer: KBKJBHJKBHJVDBKJLCB
    distributor: HJBKJHBJ
  - code: Nastya
    issuer: SC6R773OZEEHP4T5QUV3RDGNYYFW5H3HZ5PS6QOWWFPSENSVL3
    distributor: SCC577JZZ5KJDRSXRV7P7SDZFUVDWGQVKXUIB27ORVXP
  - code: Vlad
    issuer: `
All invalid (e.g. empty) public keys will be replaced with random keys.
# Usage
Create these files and launch
`npx @vladpryad/quick --[flag]`
[flag] can be:
  --issue : issue assets and create distributors 
  --populate : create sell/buy offers for needed assets (asset pairs) [NOT IMPLEMENTED]
  --all : first create assets and then populate network with their offers [NOT IMPLEMENTED]
# Output
CLI will generate file `stellarcreds.env` with all the credentials.