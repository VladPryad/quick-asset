# quick-asset
Tool for quick asset issuing and offers volume creating on Stellar network.
This CLI provides some quick mocking functions for Stellar test network.

You need to create TWO files:
# stellarfile.yaml
Consists of declaration of the network you are using.
Minimum content - one line (if it's test or public network)  
```
network: test  
horizon: https://horizon-testnet.stellar.org  
passphrase: Public Global Stellar Network ; September 2015  
```
# assetfile.yaml
Declares assets, that needs to be created (alphanum12/alphanum4 - does not matter) and pairs, that needs to be populated with offers. <br/>
IMPORTANT! 
Cross section - all assets will be crossed: [A,B,C] => A/B, B/A, A/C, C/A, B/C, C/B.
Single section allows you to specify what pairs you want: [A/B, A/C] => A/B, A/C.
```
assets:  
  - code: SECOND  
    issuer: KBKJBHJKBHJVDBKJLCB  
    distributor: HJBKJHBJ  
  - code: THIRD  
    issuer: SC6R773OZEEHP4T5QUV3RDGNYYFW5H3HZ5PS6QOWWFPSENSVL3 
    distributor: SCC577JZZ5KJDRSXRV7P7SDZFUVDWGQVKXUIB27ORVXP  
  - code: XLM  
    issuer:   
pairs:
  cross:
    - code: SECOND
      issuer: SDUYL5KXJ26EV6JTZXNKDI33GWAZRV426O7POENXL2525ZL2EZRVXNAK
      distributor: SAS3BKJYYFB7PELOZTONMUJ3TDVCKL3COTVWABSAEHE7FK2LH2YKO56L
    - code: THIRD
      issuer: SCOKXK375V5OI5KNZOOLGDAZFJPPBDYKADATS5BQSWXU5I3BPHKPUQOK
      distributor: SD7P6QAOXQO2DJJXEHIS3QDIYJXJMMNCRIC4NM55H2Q5AOXSDUWKCMQR
    - code: XLM
      issuer: 
      distributor: SDPHPIUOJJRTT6FXPGDQGLULUQPGUYWH6UU5DJLUCUYSWQ7PVRCZETFW
  single:
    - selling: 
        code: FOURTH
        issuer: SBN7V3HOXZPNJ5W5IY3GKWIG2H5TX32Y2DPYIWBIRXTECRY6S7UZSWPH 
        distributor: SD4XWYYEX3X6TDEU3GDBIMKOERL3P2KZIFQ5RWWBVBI5VBSQA4OHBIJK
      buying: 
        code: FIRST
        issuer: SD4NGJLJL3QSF5TXQ2HJGOITYT7U4YUPQ45CSTUA3BPZUIPHBOSOJG4Z
        distributor: SBAAVOMTY4NWRTZLMQ4AQQRXADANUSXS3ZRTIC4IKW3NNJH3CSL4EBSK
```
All invalid (e.g. empty) private keys (yes, all of them must be secret keys) will be replaced with random keys.
# Usage
Create these files and launch
`npx @vladpryad/quick --[flag]`
[flag] can be:  
  --issue : issue assets and create distributors   
  --populate : create sell/buy offers for needed assets (asset pairs)
  --all : first create assets and then populate network with their offers 
# Output
CLI will generate file `stellarcreds.env` with all the credentials.
# Important
If you want to create and populate same assets, you NEED to specify them both in assets and pairs sections.
The main reason - populate method can create missing accounts, but it can't distribute an asset.
So if you want to create assets A, B and C and create offers between them, you need:
1) create standart stellarfile.yaml
2) create assetfile.yaml for assets:
```
 assets:  
  - code: A  
    issuer:  
    distributor: 
  - code: B  
    issuer:  
    distributor:   
  - code: C  
    issuer: 
```
3) run npx @vladpryad/quick --issue
4) copy keys from stellarcreds.env to pairs section in assetfile.yaml
```
 pairs:
  cross:
    - code: A
      issuer: SC6R773OZEEHP4T5QUV3RDGNYYFW5H3HZ5PS6QOWWFPSENSVL3
      distributor: SC6R773OZEEHP4T5QUV3RDGNYYFW5H3HZ5PS6QOWWFPSENSVL3
    - code: B
      issuer: SC6R773OZEEHP4T5QUV3RDGNYYFW5H3HZ5PS6QOWWFPSENSVL3
      distributor: SC6R773OZEEHP4T5QUV3RDGNYYFW5H3HZ5PS6QOWWFPSENSVL3
    - code: C
      issuer: 
      distributor: SC6R773OZEEHP4T5QUV3RDGNYYFW5H3HZ5PS6QOWWFPSENSVL3
```
5) run npx @vladpryad/quick --populate   
6*) native XLM asset always goes with empty "issuer" field, but it needs "distributor" in pairs section either. 

Sometimes Stellar network randomly/due to timeout rejects some transactions, so if you expose "tx_bad_seq" error and 'op_[buy/sell]no_trust', just run the script few more times.
