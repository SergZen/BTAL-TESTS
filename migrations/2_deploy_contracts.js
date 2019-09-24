const BTALToken = artifacts.require('./BTALToken.sol');
const Exchange = artifacts.require('./Exchange.sol');
const Crowdsale = artifacts.require('./Crowdsale.sol');

module.exports = function(deployer, network, accounts) {
   if (network == "development") {
        const initialHolder = accounts[1];
        const owner = accounts[2];
        const reserveAddress = accounts[9];

        deployer.deploy(BTALToken, initialHolder, owner)
            .then((BTALTokenInstance) => {
                deployer.deploy(Crowdsale)
                    .then((crowdsaleInstance) => {
                        deployer.deploy(
                            Exchange, 
                            BTALTokenInstance.address, 
                            crowdsaleInstance.address, 
                            reserveAddress
                        )
                    })
            })
            .catch(err => console.log(err.message))
        ;
    }
};