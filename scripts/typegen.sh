#!/bin/bash

OUT=package_out
ARTIFACTS=$(ls artifacts/contracts/*/*.json | grep -v "dbg.json" | xargs -I {} echo {})

typechain --target="ethers-v5" --out-dir=$OUT/src $ARTIFACTS
cp package.contract.json $OUT/package.json
cp tsconfig.contract.json $OUT/tsconfig.json
cp yarn.contract.lock $OUT/yarn.lock

cd $OUT
yarn
yarn build
