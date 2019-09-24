/*jshint esversion: 6 */

const { shouldBehaveLikePublicRole, shouldDoActionWithRoleList } = require('./roles/PublicRole.behavior');

const { BN, balance, ether, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
const { ZERO_ADDRESS, MAX_UINT256 } = constants;
const { expect } = require('chai');

const BTALToken = artifacts.require('./BTALToken.sol');
const Exchange = artifacts.require('./Exchange.sol');
const Crowdsale = artifacts.require('./Crowdsale.sol');

contract('Crowdsale', function (accounts) {
  const ZERO_AMOUNT = new BN(0);
  const initialSupply = getBNwith10Pow(250000000);

  const hardcap = getBNwith10Pow(100000);
  const rate = getBNwith10Pow(40);
  const initialETHPrice = new BN(25000);
  const decimals = new BN(2);
  const minimum = ether('0.1');
  const reserveLimit = new BN(150000);
  const reserveTrigger = getBNwith10Pow(100000000);
  const bonusPercent = new BN(5).mul(new BN(100));

  let endTime;

  const deployer = accounts[0];
  const initialHolder = accounts[1];
  const owner = accounts[2];
  const anotherUserAccount = accounts[3];
  const tokenBuyer1 = accounts[4];
  const tokenBuyer2 = accounts[5]; 
  const walletAddress = accounts[6];
  const teamAddress = accounts[7];
  const bonusAddress = accounts[8];
  const reserveAddress = accounts[9];

  const admin = owner;
 
  let token;
  let exchange;
  let crowdsale;

  let tokenContractAddress;
  let crowdsaleСontractAddress;
  let exchangeContractAddress;

  beforeEach(async function () {
    token = await BTALToken.new(initialHolder, owner, { from: deployer });
    tokenContractAddress = token.address;

    crowdsale = await Crowdsale.new({ from: deployer });
    crowdsaleСontractAddress = crowdsale.address;
    this.contract = crowdsale;   
    
    exchange = await Exchange.new(tokenContractAddress, crowdsaleСontractAddress, reserveAddress, { from: deployer });
    exchangeContractAddress = exchange.address;

    endTime = (await time.latest()).add(time.duration.weeks(1));

    await crowdsale.init(
      rate,
      initialETHPrice,
      decimals,
      walletAddress,
      bonusAddress,
      teamAddress,
      exchangeContractAddress,
      tokenContractAddress,
      endTime,
      hardcap
    );
  });

  it('should be correct initialization crowdsale contract', async function () {
    expect(await crowdsale.rate()).to.be.bignumber.equal(rate);
    expect(await crowdsale.currentETHPrice()).to.be.bignumber.equal(initialETHPrice);
    expect(await crowdsale.currentETHPriceDecimals()).to.be.bignumber.equal(decimals);
    expect(await crowdsale.wallet()).to.equal(walletAddress);
    expect(await crowdsale.teamAddr()).to.equal(teamAddress);
    expect(await crowdsale.exchange()).to.equal(exchangeContractAddress);
    expect(await crowdsale.token()).to.equal(tokenContractAddress);
    expect(await crowdsale.endTime()).to.be.bignumber.equal(endTime);
    expect(await crowdsale.hardcap()).to.be.bignumber.equal(hardcap);

    expect(await crowdsale.weiRaised()).to.be.bignumber.equal(new BN(0));
    expect(await crowdsale.reserved()).to.be.bignumber.equal(new BN(0));
    expect(await crowdsale.tokensPurchased()).to.be.bignumber.equal(new BN(0));
  });

  describe("Whitelisted:", function () {
    const whitelisted = admin;
    const otherWhitelisted = initialHolder;
    const other = [anotherUserAccount];

    const manager = admin;
    const rolename = 'Whitelisted';
    const checkIsConstraction = false;
  
    describe('should do actions with single role', function () {
      beforeEach(async function () {
        await crowdsale.addWhitelisted(whitelisted, { from: admin });
        await crowdsale.addWhitelisted(otherWhitelisted, { from: admin });
      });
  
      shouldBehaveLikePublicRole(whitelisted, otherWhitelisted, other, rolename, manager, checkIsConstraction);
    });

    describe('should do actions with role list', function () {
      const listRoles = [whitelisted, otherWhitelisted];

      shouldDoActionWithRoleList(listRoles, rolename, manager);
    });
  });

  describe("Enlisted:", function () {
    const enlisted = admin;
    const otherEnlisted = initialHolder;
    const other = [anotherUserAccount];

    const manager = admin;
    const rolename = 'Enlisted';
    const checkIsConstraction = false;

    describe('should do actions with single role', function () {
      beforeEach(async function () {
        await crowdsale.addEnlisted(enlisted, { from: admin });
        await crowdsale.addEnlisted(otherEnlisted, { from: admin });
      });
  
      shouldBehaveLikePublicRole(enlisted, otherEnlisted, other, rolename, manager, checkIsConstraction);
    });

    describe('should do actions with role list', function () {
      const listRoles = [enlisted, otherEnlisted];

      shouldDoActionWithRoleList(listRoles, rolename, manager);
    });
  });

  describe("init", function () {
    beforeEach(async function () {
      crowdsale = await Crowdsale.new({ from: deployer });
    });

    it('should init crowdsale contract by deployer', async function () {
      await crowdsale.init(
        rate,
        initialETHPrice,
        decimals,
        walletAddress,
        bonusAddress,
        teamAddress,
        exchangeContractAddress,
        tokenContractAddress,
        endTime,
        hardcap,
        { from: deployer }
      );
    });

    it('shouldn`t init crowdsale contract by not deployer', async function () {
      await expectRevert(
        crowdsale.init(
          rate,
          initialETHPrice,
          decimals,
          walletAddress,
          bonusAddress,
          teamAddress,
          exchangeContractAddress,
          tokenContractAddress,
          endTime,
          hardcap,
          { from: anotherUserAccount }
        ),
        'revert'
      );
    });

    it('shouldn`t init crowdsale contract more then one time', async function () {
      await crowdsale.init(
        rate,
        initialETHPrice,
        decimals,
        walletAddress,
        bonusAddress,
        teamAddress,
        exchangeContractAddress,
        tokenContractAddress,
        endTime,
        hardcap
      );

      await expectRevert(
        crowdsale.init(
          rate,
          initialETHPrice,
          decimals,
          walletAddress,
          bonusAddress,
          teamAddress,
          exchangeContractAddress,
          tokenContractAddress,
          endTime,
          hardcap
        ),
        'revert'
      );
    });

    it('shouldn`t init crowdsale contract with rate equal zero', async function () {
      await expectRevert(
        crowdsale.init(
          0,
          initialETHPrice,
          decimals,
          walletAddress,
          bonusAddress,
          teamAddress,
          exchangeContractAddress,
          tokenContractAddress,
          endTime,
          hardcap
        ),
        'revert'
      );
    });

    it('shouldn`t init crowdsale contract with initialETHPrice equal zero', async function () {
      await expectRevert(
        crowdsale.init(
          rate,
          0,
          decimals,
          walletAddress,
          bonusAddress,
          teamAddress,
          exchangeContractAddress,
          tokenContractAddress,
          endTime,
          hardcap
        ),
        'revert'
      );
    });

    it('shouldn`t init crowdsale contract with wallet address equal zero address', async function () {
      await expectRevert(
        crowdsale.init(
          rate,
          initialETHPrice,
          decimals,
          ZERO_ADDRESS,
          bonusAddress,
          teamAddress,
          exchangeContractAddress,
          tokenContractAddress,
          endTime,
          hardcap
        ),
        'revert'
      );
    });

    it('shouldn`t init crowdsale contract with bonus address equal zero address', async function () {
      await expectRevert(
        crowdsale.init(
          rate,
          initialETHPrice,
          decimals,
          walletAddress,
          ZERO_ADDRESS,
          teamAddress,
          exchangeContractAddress,
          tokenContractAddress,
          endTime,
          hardcap
        ),
        'revert'
      );
    });

    it('shouldn`t init crowdsale contract with team address equal zero address', async function () {
      await expectRevert(
        crowdsale.init(
          rate,
          initialETHPrice,
          decimals,
          walletAddress,
          bonusAddress,
          ZERO_ADDRESS,
          exchangeContractAddress,
          tokenContractAddress,
          endTime,
          hardcap
        ),
        'revert'
      );
    });

    it('shouldn`t init crowdsale contract with exchange address equal zero address', async function () {
      await expectRevert(
        crowdsale.init(
          rate,
          initialETHPrice,
          decimals,
          walletAddress,
          bonusAddress,
          teamAddress,
          ZERO_ADDRESS,
          tokenContractAddress,
          endTime,
          hardcap
        ),
        'revert'
      );
    });

    it('shouldn`t init crowdsale contract with exchange address as user account address', async function () {
      await expectRevert(
        crowdsale.init(
          rate,
          initialETHPrice,
          decimals,
          walletAddress,
          bonusAddress,
          teamAddress,
          anotherUserAccount,
          tokenContractAddress,
          endTime,
          hardcap
        ),
        'revert'
      );
    });

    it('shouldn`t init crowdsale contract with token address equal zero address', async function () {
      await expectRevert(
        crowdsale.init(
          rate,
          initialETHPrice,
          decimals,
          walletAddress,
          bonusAddress,
          teamAddress,
          exchangeContractAddress,
          ZERO_ADDRESS,
          endTime,
          hardcap
        ),
        'revert'
      );
    });

    it('shouldn`t init crowdsale contract with token address as user account address', async function () {
      await expectRevert(
        crowdsale.init(
          rate,
          initialETHPrice,
          decimals,
          walletAddress,
          bonusAddress,
          teamAddress,
          anotherUserAccount,
          tokenContractAddress,
          endTime,
          hardcap
        ),
        'revert'
      );
    });

    it('shouldn`t init crowdsale contract with endTime equal zero', async function () {
      await expectRevert(
        crowdsale.init(
          rate,
          initialETHPrice,
          decimals,
          walletAddress,
          bonusAddress,
          teamAddress,
          exchangeContractAddress,
          tokenContractAddress,
          0,
          hardcap
        ),
        'revert'
      );
    });

    it('shouldn`t init crowdsale contract with hardcap equal zero', async function () {
      await expectRevert(
        crowdsale.init(
          rate,
          initialETHPrice,
          decimals,
          walletAddress,
          bonusAddress,
          teamAddress,
          exchangeContractAddress,
          tokenContractAddress,
          endTime,
          0
        ),
        'revert'
      );
    });
  });

  describe('buyTokens', function () {
    const weiAmount = ether('2');

    beforeEach(async function () {
      await token.setCrowdsaleAddr(crowdsaleСontractAddress, { from: owner });
    });

    context('shouldn`t buy token', function () {
      it('when buyer as zero address', async function () {
        await expectRevert(
          crowdsale.buyTokens(ZERO_ADDRESS, { value: weiAmount, from: tokenBuyer1 }),
          'New parameter value is the zero address'
        );
      });

      it('when wei amount is less than minimum', async function () {
        await expectRevert(
          crowdsale.buyTokens(tokenBuyer1, { value: minimum.sub(new BN(1)), from: tokenBuyer1 }),
          'Wei amount is less than minimum'
        );
      });

      it('when whitelist state and buyer isn`t in whitelisted list', async function () {
        await crowdsale.switchWhitelist({ from: admin });
        await expectRevert(
          crowdsale.buyTokens(tokenBuyer1, { value: weiAmount, from: tokenBuyer1 }),
          'Beneficiary is not whitelisted'
        );
      });

      it('when private sale and buyer isn`t in private list', async function () {
        await crowdsale.switchPrivateSale({ from: admin });
        await expectRevert(
          crowdsale.buyTokens(tokenBuyer1, { value: weiAmount, from: tokenBuyer1 }),
          'Beneficiary is not enlisted'
        );
      });

      it('when current time more than end time crowdsale', async function () {
        const newEndTime = (await time.latest()).sub(time.duration.days(1));
        
        await crowdsale.setEndTime(newEndTime, { from:admin });
        await expectRevert(
          crowdsale.buyTokens(tokenBuyer1, { value: weiAmount, from: tokenBuyer1 }),
          'revert'
        );
      });

      it('when purchased tokens equal hardcap and buyer try to buy token', async function () {
        const newHardCap = getBNwith10Pow(10000);
        const tokenBuyer1WeiAmount = ether('1');

        await crowdsale.setBonusPercent(ZERO_AMOUNT, { from: admin });
        await crowdsale.setHardCap(newHardCap, { from: admin });
        await crowdsale.buyTokens(tokenBuyer1, { value: tokenBuyer1WeiAmount, from: tokenBuyer1 });

        await expectRevert(
          crowdsale.buyTokens(tokenBuyer1, { value: weiAmount, from: tokenBuyer1 }),
          'revert'
        );
      });

      it('when state is Closed', async function () {
        await crowdsale.switchClosed({ from:admin });
        await expectRevert(
          crowdsale.buyTokens(tokenBuyer1, { value: weiAmount, from: tokenBuyer1 }),
          'revert'
        );
      });
    });

    context('should buy tokens', function () {
      context('when state Whitelist', async function () {
        it('when buyer is in whitelisted list', async function () {
          await crowdsale.addWhitelisted(tokenBuyer1, { from: admin });
          await crowdsale.switchWhitelist({ from: admin });
          await crowdsale.buyTokens(tokenBuyer1, { value: weiAmount, from: tokenBuyer1 });
        });
      });

      context('when state PrivateSale', async function () {
        it('when buyer is in private list', async function () {
          await crowdsale.addEnlisted(tokenBuyer1, { from: admin });
          await crowdsale.switchPrivateSale({ from: admin });
          await crowdsale.buyTokens(tokenBuyer1, { value: weiAmount, from: tokenBuyer1 });
        });
      });

      context('when any state', async function () {
        it('should buy tokens with bonus', async function () {
          const tokenBuyer1WeiAmount = ether("0.2");
          const tokenBuyer2WeiAmount = ether("0.3");
          const totalWeiAmount = tokenBuyer1WeiAmount.add(tokenBuyer2WeiAmount);
          const expectedBuyer1TokenAmount = getBNwith10Pow(2000);
          const expectedBuyer2TokenAmount = getBNwith10Pow(3000);
          const expectedBuyer1BonusTokenAmount = getBNwith10Pow(100);
          const expectedBuyer2BonusTokenAmount = getBNwith10Pow(150);
          const totalBonusTokenAmount = expectedBuyer1BonusTokenAmount.add(expectedBuyer2BonusTokenAmount);

          const totalBalance = await balance.current(walletAddress);
          const expectedTotalBalance = totalBalance.add(totalWeiAmount);

          expect(await token.balanceOf(bonusAddress)).to.be.bignumber.equal(ZERO_AMOUNT);

          expect(await token.balanceOf(tokenBuyer1)).to.be.bignumber.equal(ZERO_AMOUNT);
          await crowdsale.buyTokens(tokenBuyer1, { value: tokenBuyer1WeiAmount, from: tokenBuyer1 });
         
          expect(await token.balanceOf(tokenBuyer1)).to.be.bignumber.equal(expectedBuyer1TokenAmount);
          expect(await token.balanceOf(bonusAddress)).to.be.bignumber.equal(expectedBuyer1BonusTokenAmount);

          expect(await token.balanceOf(tokenBuyer2)).to.be.bignumber.equal(ZERO_AMOUNT);
          await crowdsale.buyTokens(tokenBuyer2, { value: tokenBuyer2WeiAmount, from: tokenBuyer2 });
      
          expect(await token.balanceOf(tokenBuyer2)).to.be.bignumber.equal(expectedBuyer2TokenAmount);
 
          expect(await balance.current(crowdsaleСontractAddress)).to.be.bignumber.equal(ZERO_AMOUNT);
          expect(await balance.current(walletAddress)).to.be.bignumber.equal(expectedTotalBalance);
          expect(await token.balanceOf(bonusAddress)).to.be.bignumber.equal(totalBonusTokenAmount);
        });

        it('should buy tokens without bonus', async function () {
          const tokenBuyer1WeiAmount = ether("0.2");
          const tokenBuyer2WeiAmount = ether("0.3");
          const totalWeiAmount = tokenBuyer1WeiAmount.add(tokenBuyer2WeiAmount);
          const expectedBuyer1TokenAmount = getBNwith10Pow(2000);
          const expectedBuyer2TokenAmount = getBNwith10Pow(3000);

          const totalBalance = await balance.current(walletAddress);
          const expectedTotalBalance = totalBalance.add(totalWeiAmount);

          await crowdsale.setBonusPercent(ZERO_AMOUNT, { from: admin });

          expect(await token.balanceOf(tokenBuyer1)).to.be.bignumber.equal(ZERO_AMOUNT);
          await crowdsale.buyTokens(tokenBuyer1, { value: tokenBuyer1WeiAmount, from: tokenBuyer1 });
          expect(await token.balanceOf(tokenBuyer1)).to.be.bignumber.equal(expectedBuyer1TokenAmount);

          expect(await token.balanceOf(tokenBuyer2)).to.be.bignumber.equal(ZERO_AMOUNT);
          await crowdsale.buyTokens(tokenBuyer2, { value: tokenBuyer2WeiAmount, from: tokenBuyer2 });
          expect(await token.balanceOf(tokenBuyer2)).to.be.bignumber.equal(expectedBuyer2TokenAmount);
 
          expect(await balance.current(crowdsaleСontractAddress)).to.be.bignumber.equal(ZERO_AMOUNT);
          expect(await balance.current(walletAddress)).to.be.bignumber.equal(expectedTotalBalance);
       
        });

        it('should buy by fallback function', async function () {
          const newHardCap = getBNwith10Pow(10000);
          const tokenBuyer1WeiAmount = ether('1');

          await crowdsale.setBonusPercent(ZERO_AMOUNT, { from: admin });
          await crowdsale.setHardCap(newHardCap, { from: admin });
          expect(await token.balanceOf(tokenBuyer1)).to.be.bignumber.equal(ZERO_AMOUNT);
          await crowdsale.sendTransaction({ value: tokenBuyer1WeiAmount, from: tokenBuyer1 });
          expect(await token.balanceOf(tokenBuyer1)).to.be.bignumber.equal(newHardCap);
        }); 

        it('should buy all tokens', async function () {
          const newHardCap = getBNwith10Pow(10000);
          const tokenBuyer1WeiAmount = ether('1');

          await crowdsale.setBonusPercent(ZERO_AMOUNT, { from: admin });
          await crowdsale.setHardCap(newHardCap, { from: admin });
          expect(await token.balanceOf(tokenBuyer1)).to.be.bignumber.equal(ZERO_AMOUNT);
          await crowdsale.buyTokens(tokenBuyer1, { value: tokenBuyer1WeiAmount, from: tokenBuyer1 });
          expect(await token.balanceOf(tokenBuyer1)).to.be.bignumber.equal(newHardCap);
        });  

        it('should buy tokens with new bonus', async function () {
          const newBonus = 1000;
          const tokenBuyer1WeiAmount = ether('1');
          const expectedTokenAmount = getBNwith10Pow(10000);

          await crowdsale.setBonusPercent(newBonus, { from: admin });

          expect(await token.balanceOf(tokenBuyer1)).to.be.bignumber.equal(ZERO_AMOUNT);
          await crowdsale.buyTokens(tokenBuyer1, { value: tokenBuyer1WeiAmount, from: tokenBuyer1 });
          expect(await token.balanceOf(tokenBuyer1)).to.be.bignumber.equal(expectedTokenAmount);
        }); 
        
        it('should buy all tokens and refund over', async function () {
          const newHardCap = getBNwith10Pow(10000);
          const tokenBuyer1WeiAmount = ether('3');

          await crowdsale.setBonusPercent(ZERO_AMOUNT, { from: admin });
          await crowdsale.setHardCap(newHardCap, { from: admin });
          expect(await token.balanceOf(tokenBuyer1)).to.be.bignumber.equal(ZERO_AMOUNT);
          const { logs } = await crowdsale.buyTokens(tokenBuyer1, { value: tokenBuyer1WeiAmount, from: tokenBuyer1 });
          expect(await token.balanceOf(tokenBuyer1)).to.be.bignumber.equal(newHardCap);

          expectEvent.inLogs(logs, 'Payout', {
            recipient: tokenBuyer1,
            weiAmount: ether('2'),
            usdAmount: new BN(500)
          });

          expectEvent.inLogs(logs, 'Payout', {
            recipient: walletAddress,
            weiAmount: ether('1'),
            usdAmount: new BN(250)
          });
        });

        it('emits events during buy tokens', async function () {
          const sender = tokenBuyer1; 
          const beneficiary = tokenBuyer1;
          const weiAmount = ether('1'); 
          const tokenAmount = getBNwith10Pow(10000); 
          const usdAmount = new BN(250);

          const { logs } = await crowdsale.buyTokens(beneficiary, { value: weiAmount, from: sender });

          const expectedBonusTokenAmount = getBNwith10Pow(500);
          expectEvent.inLogs(logs, 'BonusPayed', {
            beneficiary: beneficiary,
            amount: expectedBonusTokenAmount
          });

          expectEvent.inLogs(logs, 'Payout', {
            recipient: walletAddress,
            weiAmount: weiAmount,
            usdAmount: usdAmount
          });

          expectEvent.inLogs(logs, 'TokensPurchased', {
            purchaser: sender,
            beneficiary: beneficiary,
            value: weiAmount,
            amount: tokenAmount
          });
        });
      });

      context('reserve', async function () {
        const reserveTrigger = getBNwith10Pow(10000);
        const reverveLimit = new BN(500);

        beforeEach(async function () {
          await crowdsale.setReserveTrigger(reserveTrigger, { from: admin });
          await crowdsale.setReserveLimit(reverveLimit, { from: admin });

          expect(await crowdsale.reserved()).to.be.bignumber.equal(ZERO_AMOUNT);
        });

        it('shouldn`t reserve before reserve trigger', async function () {
          const tokenBuyer2WeiAmount = ether('1');

          await crowdsale.buyTokens(tokenBuyer2, { value: tokenBuyer2WeiAmount, from: tokenBuyer2 });
          expect(await crowdsale.reserved()).to.be.bignumber.equal(ZERO_AMOUNT);
        });
        
        it('should reserve when purchased tokens equal reserve trigger', async function () {
          const tokenBuyer2WeiAmount1 = ether('1');
          const tokenBuyer2WeiAmount2 = ether('3');

          await crowdsale.buyTokens(tokenBuyer2, { value: tokenBuyer2WeiAmount1, from: tokenBuyer2 });
          expect(await crowdsale.reserved()).to.be.bignumber.equal(ZERO_AMOUNT);

          await crowdsale.buyTokens(tokenBuyer2, { value: tokenBuyer2WeiAmount2, from: tokenBuyer2 });

          expect(await crowdsale.reserved()).to.be.bignumber.equal(reverveLimit);
        });

        it('should reserve after reserve trigger', async function () {
          const tokenBuyer2WeiAmount1 = ether('0.5');
          const tokenBuyer2WeiAmount2 = ether('2.5');

          await crowdsale.buyTokens(tokenBuyer2, { value: tokenBuyer2WeiAmount1, from: tokenBuyer2 });
          expect(await crowdsale.reserved()).to.be.bignumber.equal(ZERO_AMOUNT);

          const { logs } = await crowdsale.buyTokens(tokenBuyer2, { value: tokenBuyer2WeiAmount2, from: tokenBuyer2 });
          expectEvent.inLogs(logs, 'ReserveState', {
            isActive: true
          });

          expect(await crowdsale.reserved()).to.be.bignumber.equal(reverveLimit);
        });
        
        it('shouldn`t reserve before reserve limit', async function () {
          const tokenBuyer2WeiAmount1 = ether('0.5');
          const tokenBuyer2WeiAmount2 = ether('2.5');
          const tokenBuyer2WeiAmount3 = ether('1');

          await crowdsale.buyTokens(tokenBuyer2, { value: tokenBuyer2WeiAmount1, from: tokenBuyer2 });
          expect(await crowdsale.reserved()).to.be.bignumber.equal(ZERO_AMOUNT);

          await crowdsale.buyTokens(tokenBuyer2, { value: tokenBuyer2WeiAmount2, from: tokenBuyer2 });
          expect(await crowdsale.reserved()).to.be.bignumber.equal(reverveLimit);

          await crowdsale.buyTokens(tokenBuyer2, { value: tokenBuyer2WeiAmount3, from: tokenBuyer2 });
          expect(await crowdsale.reserved()).to.be.bignumber.equal(reverveLimit);
        }); 
      }); 
    });    
  });

  describe('sendTokens', function () {
    const amountTokens = new BN('1000000000');

    beforeEach(async function () {
    await token.setCrowdsaleAddr(crowdsaleСontractAddress, { from: owner });
    });
    
    it('should sendTokens only admin', async function () {
      await crowdsale.sendTokens(anotherUserAccount, amountTokens, { from: admin });

      expect(await token.balanceOf(anotherUserAccount)).to.be.bignumber.equal(amountTokens);

      expect(await crowdsale.tokensPurchased()).to.be.bignumber.equal(amountTokens);
    });

    it('emits a TokensSent event', async function () {
      const { logs } = await crowdsale.sendTokens(anotherUserAccount, amountTokens, { from: admin });
       
      expectEvent.inLogs(logs, 'TokensSent', {
        sender: admin,
        beneficiary: anotherUserAccount,
        amount: amountTokens
      });
    });

    it('shouldn`t sendTokens not admin', async function () {
      await expectRevert(
        crowdsale.sendTokens(anotherUserAccount, amountTokens, { from: anotherUserAccount }),
        'revert'
      );
    });

    it('shouldn`t sendTokens with zero address recipient', async function () {
      await expectRevert(
        crowdsale.sendTokensPerWei(ZERO_ADDRESS, amountTokens, { from: admin }),
        'Recipient is the zero address'
      );
    });

    it('shouldn`t sendTokens with max uint token amount', async function () {
      await expectRevert(
        crowdsale.sendTokens(anotherUserAccount, MAX_UINT256, { from: admin }),
        'revert'
      );
    });
  });

  describe('sendTokensToList', function () {
    const amountTokens = new BN('1000000000');
    const accountsList = accounts.slice(4, 9);

    beforeEach(async function () {
      await token.setCrowdsaleAddr(crowdsaleСontractAddress, { from: owner });
    });

    it('should sendTokensToList only admin', async function () {
      await crowdsale.sendTokensToList(accountsList, amountTokens, { from: admin });

      for(let i = 0; i < accountsList.length; i++) {
        expect(await token.balanceOf(accountsList[i])).to.be.bignumber.equal(amountTokens);
      }

      expect(await crowdsale.tokensPurchased()).to.be.bignumber.equal(new BN(amountTokens * accountsList.length));
    });

    it('emits a TokensSent event', async function () {
      const { logs } = await crowdsale.sendTokensToList(accountsList, amountTokens, { from: admin });

      for(let i = 0; i < accountsList.length; i++) {
        expect(await token.balanceOf(accountsList[i])).to.be.bignumber.equal(amountTokens);
        
        expectEvent.inLogs(logs, 'TokensSent', {
          sender: admin,
          beneficiary: accountsList[i],
          amount: amountTokens
        });
      }
    });

    it('shouldn`t sendTokensToList not admin', async function () {
      await expectRevert(
        crowdsale.sendTokensToList(accountsList, amountTokens, { from: anotherUserAccount }),
        'revert'
      );
    });

    it('shouldn`t sendTokensToList with empty recipients', async function () {
      await expectRevert(
        crowdsale.sendTokensToList([], amountTokens, { from: admin }),
        'revert'
      );
    });

    it('shouldn`t sendTokensToList with zero address recipient', async function () {
      await expectRevert(
        crowdsale.sendTokensToList([ZERO_ADDRESS], amountTokens, { from: admin }),
        'Recipient is the zero address'
      );
    });

    it('shouldn`t sendTokensToList with max uint token amount', async function () {
      await expectRevert(
        crowdsale.sendTokensToList(accountsList, MAX_UINT256, { from: admin }),
        'revert'
      );
    });
  });
  
  describe('sendTokensPerWei', function () {
    const amountWei = ether('1');
    const expectedAmountTokens = getBNwith10Pow(10000);

    beforeEach(async function () {
      await token.setCrowdsaleAddr(crowdsaleСontractAddress, { from: owner });
    });
    
    it('should sendTokensPerWei only admin', async function () {
      await crowdsale.sendTokensPerWei(anotherUserAccount, amountWei, { from: admin });

      expect(await token.balanceOf(anotherUserAccount)).to.be.bignumber.equal(expectedAmountTokens);

      expect(await crowdsale.tokensPurchased()).to.be.bignumber.equal(expectedAmountTokens);
    });

    it('emits a TokensSent event', async function () {
      const { logs } = await crowdsale.sendTokensPerWei(anotherUserAccount, amountWei, { from: admin });
       
      expectEvent.inLogs(logs, 'TokensSent', {
        sender: admin,
        beneficiary: anotherUserAccount,
        amount: expectedAmountTokens
      });
    });

    it('shouldn`t sendTokensPerWei not admin', async function () {
      await expectRevert(
        crowdsale.sendTokensPerWei(anotherUserAccount, amountWei, { from: anotherUserAccount }),
        'revert'
      );
    });

    it('shouldn`t sendTokensPerWei with zero address recipient', async function () {
      await expectRevert(
        crowdsale.sendTokensPerWei(ZERO_ADDRESS, amountWei, { from: admin }),
        'Recipient is the zero address'
      );
    });

    it('shouldn`t sendTokensPerWei with max uint token amount', async function () {
      await expectRevert(
        crowdsale.sendTokensPerWei(anotherUserAccount, MAX_UINT256, { from: admin }),
        'revert'
      );
    });
  });

  describe('sendTokensPerWeiToList', function () {
    const amountWei = ether('1');
    const expectedAmountTokens = getBNwith10Pow(10000);
    const accountsList = accounts.slice(4, 9);
    const wholeExpectedAmountTokens = getBNwith10Pow(10000 * accountsList.length);

    beforeEach(async function () {
      await token.setCrowdsaleAddr(crowdsaleСontractAddress, { from: owner });
    });

    it('should sendTokensPerWeiToList only admin', async function () {
      await crowdsale.sendTokensPerWeiToList(accountsList, amountWei, { from: admin });

      for(let i = 0; i < accountsList.length; i++) {
        expect(await token.balanceOf(accountsList[i])).to.be.bignumber.equal(expectedAmountTokens);
      }

      expect(await crowdsale.tokensPurchased()).to.be.bignumber.equal(wholeExpectedAmountTokens);
    });

    it('emits a TokensSent event', async function () {
      const { logs } = await crowdsale.sendTokensPerWeiToList(accountsList, amountWei, { from: admin });

      for(let i = 0; i < accountsList.length; i++) {
        expectEvent.inLogs(logs, 'TokensSent', {
          sender: admin,
          beneficiary: accountsList[i],
          amount: expectedAmountTokens
        });
      }
    });

    it('shouldn`t sendTokensPerWeiToList not admin', async function () {
      await expectRevert(
        crowdsale.sendTokensPerWeiToList(accountsList, amountWei, { from: anotherUserAccount }),
        'revert'
      );
    });

    it('shouldn`t sendTokensPerWeiToList with empty recipients', async function () {
      await expectRevert(
        crowdsale.sendTokensPerWeiToList([], amountWei, { from: admin }),
        'revert'
      );
    });

    it('shouldn`t sendTokensPerWeiToList with zero address recipient', async function () {
      await expectRevert(
        crowdsale.sendTokensPerWeiToList([ZERO_ADDRESS], amountWei, { from: admin }),
        'Recipient is the zero address'
      );
    });

    it('shouldn`t sendTokensPerWeiToList with max uint token amount', async function () {
      await expectRevert(
        crowdsale.sendTokensPerWeiToList(accountsList, MAX_UINT256, { from: admin }),
        'revert'
      );
    });
  });

  describe('finishSale', function () {
    context('admin', function () {
      it('should finishSale when hardcap crowdsale reached', async function () {
        const teamTokens = getBNwith10Pow(30000);
        const anotherTokens = getBNwith10Pow(70000);
        const sendWei = ether('1');
        const reserveBalance = await balance.current(reserveAddress);

        await token.setCrowdsaleAddr(crowdsaleСontractAddress, { from: owner });
 
        await crowdsale.sendTokens(anotherUserAccount, anotherTokens, { from: admin });
        await crowdsale.sendTokens(teamAddress, teamTokens, { from: admin });

        const tokenHardcap = await token.hardcap();
        const tokenTotalSupply = await token.totalSupply();
        const reserveBalanceTokens = tokenHardcap.sub(tokenTotalSupply);

        await exchange.acceptETH({from: tokenBuyer2, value: sendWei});
       
        const { logs } = await crowdsale.finishSale({ from: admin });

        expectEvent.inLogs(logs, 'StateChanged', {
          currentState: 'Usual',
        });

        expect(await token.balanceOf(reserveAddress)).to.be.bignumber.equal(reserveBalanceTokens);
        expect(await token.balanceOf(teamAddress)).to.be.bignumber.equal(teamTokens);

        expect(await token.released()).to.equal(true);

        expect(await balance.current(exchangeContractAddress)).to.be.bignumber.equal(new BN(0));
        expect(await balance.current(reserveAddress)).to.be.bignumber.equal(reserveBalance.add(sendWei));
      });
  
      it('should finishSale when end time reached', async function () {
        const teamTokens = new BN(1000);
        
        const endTime = (await time.latest()).sub(time.duration.hours(1));
        await crowdsale.setEndTime(endTime, { from: admin });

        await token.setCrowdsaleAddr(crowdsaleСontractAddress, { from: owner });

        await crowdsale.sendTokens(teamAddress, teamTokens, { from: admin });
  
        await crowdsale.finishSale({ from: admin });
      });

      it('shouldn`t finishSale when hardcap crowdsale and end time not reached', async function () {
        await expectRevert(
          crowdsale.finishSale({ from: admin }),
          'revert'
        );
      });
    });
    
    context('not admin', function () {
      it('shouldn`t finishSale', async function () {
        await expectRevert(
          crowdsale.finishSale({ from: anotherUserAccount }),
          'revert'
        );
      });
    });
  });

  describe('isEnded', function () {
    it('should be true when hardcap crowdsale reached', async function () {
      const newHardCap = new BN(1000);

      await token.setCrowdsaleAddr(crowdsaleСontractAddress, { from: owner });
      await crowdsale.setHardCap(newHardCap, { from: admin });
      
      await crowdsale.sendTokens(anotherUserAccount, newHardCap, { from: admin });

      expect(await crowdsale.isEnded()).to.equal(true);
    });
  
    it('should be true when end time reached', async function () {
      const endTime = (await time.latest()).sub(time.duration.hours(1));
      await crowdsale.setEndTime(endTime, { from: admin });

      expect(await crowdsale.isEnded()).to.equal(true);
    });

    it('should be false when hardcap crowdsale or end time not reached', async function () {
      expect(await crowdsale.isEnded()).to.equal(false);
    });
  });

  describe('rate', function () {
    it('has a rate', async function () {
      expect(await crowdsale.rate()).to.be.bignumber.equal(rate);
    });

    it('should set rate only admin', async function () {
      const newRate = rate.addn(1);
      await crowdsale.setRate(newRate, { from: admin });
  
      expect(await crowdsale.rate()).to.be.bignumber.equal(newRate);
    });
  
    it('shouldn`t set rate not admin', async function () {
      const newRate = rate.addn(1);

      await expectRevert(
        crowdsale.setRate(newRate, { from: anotherUserAccount }),
        'revert'
      );
    });

    it('shouldn`t set rate as zero', async function () {
      const newRate = new BN(0);
     
      await expectRevert(
        crowdsale.setRate(newRate, { from: admin }),
        'New parameter value is 0'
      );
    });
  });    

  describe('EthPriceProvider', function () {
    it('has the EthPriceProvider is the zero address after creation', async function () {
      expect(await crowdsale.priceProvider()).to.equal(ZERO_ADDRESS);
    });

    describe('when the EthPriceProvider is not the zero address', function () {
      it('should set EthPriceProvider only admin', async function () {
        const anyContractAddress = tokenContractAddress;

        
        await crowdsale.setEthPriceProvider(anyContractAddress, { from: admin });
    
        expect(await crowdsale.priceProvider()).to.equal(anyContractAddress);
      });

      it('shouldn`t set EthPriceProvider as user account address', async function () {
        await expectRevert(
          crowdsale.setEthPriceProvider(anotherUserAccount, { from: admin }),
          'revert'
        );
      });

      it('shouldn`t set EthPriceProvider not admin', async function () {
        const anyContractAddress = tokenContractAddress;
        await expectRevert(
          crowdsale.setEthPriceProvider(anyContractAddress, { from: anotherUserAccount }),
          'revert'
        );
      });
    });

    describe('when the EthPriceProvider is the zero address', function () {
      it('reverts', async function () {
        await expectRevert(
          crowdsale.setEthPriceProvider(ZERO_ADDRESS, { from: admin }),
          'New parameter value is the zero address'
        );
      });
    });
  });
    
  describe('wallet', function () {
    it('has the wallet', async function () {
      expect(await crowdsale.wallet()).to.equal(walletAddress);
    });

    describe('when the wallet is not the zero address', function () {
      it('should set wallet only admin', async function () {
        const anyContractAddress = tokenContractAddress;
        await crowdsale.setWallet(anyContractAddress, { from: admin });
        expect(await crowdsale.wallet()).to.equal(anyContractAddress);
      });

      it('shouldn`t set wallet not admin', async function () {
        const anyContractAddress = tokenContractAddress;
        await expectRevert(
          crowdsale.setWallet(anyContractAddress, { from: anotherUserAccount }),
          'revert'
        );
      });
    });

    describe('when the wallet is the zero address', function () {
      it('reverts', async function () {
        await expectRevert(
          crowdsale.setWallet(ZERO_ADDRESS, { from: admin }),
          'New parameter value is the zero address'
        );
      });
    });
  });

  describe('TeamAddr', function () {
    it('has the team address', async function () {
      expect(await crowdsale.teamAddr()).to.equal(teamAddress);
    });

    describe('when the team address is not the zero address', function () {
      it('should set team address only admin', async function () {
        const anyContractAddress = tokenContractAddress;
        await crowdsale.setTeamAddr(anyContractAddress, { from: admin });
        expect(await crowdsale.teamAddr()).to.equal(anyContractAddress);
      });

      it('shouldn`t set team address not admin', async function () {
        const anyContractAddress = tokenContractAddress;
        await expectRevert(
          crowdsale.setTeamAddr(anyContractAddress, { from: anotherUserAccount }),
          'revert'
        );
      });
    });

    describe('when the set team is the zero address', function () {
      it('reverts', async function () {
        await expectRevert(
          crowdsale.setTeamAddr(ZERO_ADDRESS, { from: admin }),
          'New parameter value is the zero address'
        );
      });
    });
  });

  describe('Bonus address', function () {
    it('has the bonus address', async function () {
      expect(await crowdsale.bonusAddr()).to.equal(bonusAddress);
    });

    describe('when the bonus address is not the zero address', function () {
      it('should set bonus address only admin', async function () {
        const anyContractAddress = tokenContractAddress;
        await crowdsale.setBonusAddr(anyContractAddress, { from: admin });
        expect(await crowdsale.bonusAddr()).to.equal(anyContractAddress);
      });

      it('shouldn`t set bonus address not admin', async function () {
        const anyContractAddress = tokenContractAddress;
        await expectRevert(
          crowdsale.setBonusAddr(anyContractAddress, { from: anotherUserAccount }),
          'revert'
        );
      });
    });

    describe('when the set bonus is the zero address', function () {
      it('reverts', async function () {
        await expectRevert(
          crowdsale.setBonusAddr(ZERO_ADDRESS, { from: admin }),
          'New parameter value is the zero address'
        );
      });
    });
  });
  
  describe('exchange address', function () {
    it('has the exchange address', async function () {
      expect(await crowdsale.exchange()).to.equal(exchangeContractAddress);
    });

    describe('when the exchange address is not the zero address', function () {
      it('should set exchange address only admin', async function () {
        const anyContractAddress = tokenContractAddress;
        await crowdsale.setExchangeAddr(anyContractAddress, { from: admin });
    
        expect(await crowdsale.exchange()).to.equal(anyContractAddress);
      });

      it('shouldn`t set exchange address as user account address', async function () {
        await expectRevert(
          crowdsale.setExchangeAddr(anotherUserAccount, { from: admin }),
          'revert'
        );
      });

      it('shouldn`t set exchange address not admin', async function () {
        const anyContractAddress = tokenContractAddress;
        await expectRevert(
          crowdsale.setExchangeAddr(anyContractAddress, { from: anotherUserAccount }),
          'revert'
        );
      });
    });

    describe('when the exchange address is the zero address', function () {
      it('reverts', async function () {
        await expectRevert(
          crowdsale.setExchangeAddr(ZERO_ADDRESS, { from: admin }),
          'New parameter value is the zero address'
        );
      });
    });
  });  
    
  describe('ETH price', function () {
    it('has a ETH price', async function () {
      expect(await crowdsale.currentETHPrice()).to.be.bignumber.equal(initialETHPrice);
    });

    it('should set Eth Price by admin', async function () {
      const newETHPrice = initialETHPrice.addn(1);
      await crowdsale.setETHPrice(newETHPrice, { from: admin });
  
      expect(await crowdsale.currentETHPrice()).to.be.bignumber.equal(newETHPrice);
    });

    it('emits a NewETHPrice event', async function () {
      const newETHPrice = initialETHPrice.addn(1);
      const currentETHPrice = await crowdsale.currentETHPrice();
      const currentDecimals = await crowdsale.currentETHPriceDecimals();

      const { logs } = await crowdsale.setETHPrice(newETHPrice, { from: admin });

      expectEvent.inLogs(logs, 'NewETHPrice', {
        oldValue: currentETHPrice,
        newValue: newETHPrice,
        decimals: currentDecimals
      });
    });
  
    it('shouldn`t set ETH price not admin', async function () {
      const newETHPrice = initialETHPrice.addn(1);

      await expectRevert(
        crowdsale.setETHPrice(newETHPrice, { from: anotherUserAccount }),
        'revert'
      );
    });

    it('shouldn`t set ETH price as zero', async function () {
      const newETHPrice = 0;
     
      await expectRevert(
        crowdsale.setETHPrice(newETHPrice, { from: admin }),
        'New parameter value is 0'
      );
    });
  }); 
  
  describe('decimals', function () {
    it('has a ETH price', async function () {
      expect(await crowdsale.currentETHPriceDecimals()).to.be.bignumber.equal(decimals);
    });

    it('should set decimals by admin', async function () {
      const newDecimals = decimals.addn(1);
      await crowdsale.setDecimals(newDecimals, { from: admin });

      expect(await crowdsale.currentETHPriceDecimals()).to.be.bignumber.equal(newDecimals);
    });
  
    it('shouldn`t set decimals not admin', async function () {
      const newDecimals = decimals.addn(1);

      await expectRevert(
        crowdsale.setDecimals(newDecimals, { from: anotherUserAccount }),
        'revert'
      );
    });
  });
  
  describe('end time', function () {
    it('has a end time', async function () {
      expect(await crowdsale.endTime()).to.be.bignumber.equal(endTime);
    });

    it('should set end time only admin', async function () {
      const newEndTime = endTime.addn(1);
      await crowdsale.setEndTime(newEndTime, { from: admin });
  
      expect(await crowdsale.endTime()).to.be.bignumber.equal(newEndTime);
    });
  
    it('shouldn`t set end time not admin', async function () {
      const newEndTime = endTime.addn(1);

      await expectRevert(
        crowdsale.setEndTime(newEndTime, { from: anotherUserAccount }),
        'revert'
      );
    });

    it('shouldn`t set end time as zero', async function () {
      const newEndTime = new BN(0);
     
      await expectRevert(
        crowdsale.setEndTime(newEndTime, { from: admin }),
        'New parameter value is 0'
      );
    });
  });

  describe('bonus percent', function () {
    it('has the default bonus percent', async function () {
      expect(await crowdsale.bonusPercent()).to.be.bignumber.equal(bonusPercent);
    });

    it('should set bonus percent only admin', async function () {
      const newBonusPercent = new BN(1);
      await crowdsale.setBonusPercent(newBonusPercent, { from: admin });
  
      expect(await crowdsale.bonusPercent()).to.be.bignumber.equal(newBonusPercent);
    });
 
    it('shouldn`t set bonus percent not admin', async function () {
      const newBonusPercent = 1;

      await expectRevert(
        crowdsale.setBonusPercent(newBonusPercent, { from: anotherUserAccount }),
        'revert'
      );
    });
  });

  describe('hardcap', function () {
    it('has a hardcap', async function () {
      expect(await crowdsale.hardcap()).to.be.bignumber.equal(hardcap);
    });

    it('should set hardcap only admin', async function () {
      const newHardCap = hardcap.addn(1);
      await crowdsale.setHardCap(newHardCap, { from: admin });
  
      expect(await crowdsale.hardcap()).to.be.bignumber.equal(newHardCap);
    });
  
    it('shouldn`t set hardcap not admin', async function () {
      const newHardCap = hardcap.addn(1);

      await expectRevert(
        crowdsale.setHardCap(newHardCap, { from: anotherUserAccount }),
        'revert'
      );
    });

    it('shouldn`t set hardcap as zero', async function () {
      const newHardCap = new BN(0);
     
      await expectRevert(
        crowdsale.setHardCap(newHardCap, { from: admin }),
        'New parameter value is 0'
      );
    });
  });
    
  describe('minimum', function () {
    it('has a minimum', async function () {
      expect(await crowdsale.minimum()).to.be.bignumber.equal(minimum);
    });

    it('should set minimum only admin', async function () {
      const newMinimum = ether('1');
      await crowdsale.setMinimum(newMinimum, { from: admin });
  
      expect(await crowdsale.minimum()).to.be.bignumber.equal(newMinimum);
    });
  
    it('shouldn`t set minimum not admin', async function () {
      const newMinimum = ether('1');

      await expectRevert(
        crowdsale.setMinimum(newMinimum, { from: anotherUserAccount }),
        'revert'
      );
    });

    it('shouldn`t set minimum as zero', async function () {
      const newMinimum = ether('0');
     
      await expectRevert(
        crowdsale.setMinimum(newMinimum, { from: admin }),
        'New parameter value is 0'
      );
    });
  });    
   
  describe('reserveLimit', function () {
    it('has a reserveLimit', async function () {
      expect(await crowdsale.reserveLimit()).to.be.bignumber.equal(reserveLimit);
    });

    it('should set reserveLimit only admin', async function () {
      const newReserveLimit = reserveLimit.addn(1);
      await crowdsale.setReserveLimit(newReserveLimit, { from: admin });
  
      expect(await crowdsale.reserveLimit()).to.be.bignumber.equal(newReserveLimit);
    });
  
    it('shouldn`t set reserveLimit not admin', async function () {
      const newReserveLimit = reserveLimit.addn(1);

      await expectRevert(
        crowdsale.setReserveLimit(newReserveLimit, { from: anotherUserAccount }),
        'revert'
      );
    });

    it('shouldn`t set reserveLimit as zero', async function () {
      const newReserveLimit = new BN(0);
     
      await expectRevert(
        crowdsale.setReserveLimit(newReserveLimit, { from: admin }),
        'New parameter value is 0'
      );
    });
  });

  describe('reserveTrigger', function () {
    it('has a reserveTrigger', async function () {
      expect(await crowdsale.reserveTrigger()).to.be.bignumber.equal(reserveTrigger);
    });

    it('should set reserveTrigger only admin', async function () {
      const newReserveTrigger = reserveTrigger.addn(1);
      await crowdsale.setReserveTrigger(newReserveTrigger, { from: admin });
  
      expect(await crowdsale.reserveTrigger()).to.be.bignumber.equal(newReserveTrigger);
    });
  
    it('shouldn`t set reserveTrigger not admin', async function () {
      const newReserveTrigger = reserveTrigger.addn(1);

      await expectRevert(
        crowdsale.setReserveTrigger(newReserveTrigger, { from: anotherUserAccount }),
        'revert'
      );
    });

    it('shouldn`t set reserveTrigger as zero', async function () {
      const newReserveTrigger = new BN(0);
     
      await expectRevert(
        crowdsale.setReserveTrigger(newReserveTrigger, { from: admin }),
        'New parameter value is 0'
      );
    });
  });

  describe('state', function () {
    it('has a correct initial state', async function () {
      expect(await crowdsale.state()).to.be.bignumber.equal(getStateByName("Usual"));
    });
    
    shouldChangeState('Whitelist');
    shouldChangeState('PrivateSale');
    shouldChangeState('Closed');    
  });

  describe('withdraw ERC20', function () {
    describe('when the recipient is not the zero address', function () {
      it('should withdraw ERC20 only admin', async function () {
        const amount = new BN('1000000000');
        const userAccountAddress = anotherUserAccount;
  
        await token.mint(crowdsaleСontractAddress, amount, { from: admin });
        expect(await token.balanceOf(crowdsaleСontractAddress)).to.be.bignumber.equal(amount);
        expect(await token.balanceOf(userAccountAddress)).to.be.bignumber.equal('0');
  
        await crowdsale.withdrawERC20(tokenContractAddress, userAccountAddress, { from: admin });
        expect(await token.balanceOf(crowdsaleСontractAddress)).to.be.bignumber.equal('0');
        expect(await token.balanceOf(userAccountAddress)).to.be.bignumber.equal(amount);
      });
  
      it('shouldn`t withdraw ERC20 not admin', async function () {
        await expectRevert(
          crowdsale.withdrawERC20(tokenContractAddress, anotherUserAccount, { from: anotherUserAccount }),
          'revert'
        );
      });
  
      it('shouldn`t withdraw ERC20 with zero balance', async function () {
        const emptyBalance = new BN(0);
        await expectRevert(
          crowdsale.withdrawERC20(tokenContractAddress, admin, { from: admin }),
          'revert'
        );
      });
    });
  
    describe('when the recipient is the zero address', function () {
      it('reverts', async function () {
        await expectRevert(
          token.withdrawERC20(crowdsaleСontractAddress, ZERO_ADDRESS, { from: admin }),
          'revert'
        );
      });
    });
  });

  function getStateByName(name) {
    const State = {
      'Usual': new BN(0),
      'Whitelist': new BN(1),
      'PrivateSale': new BN(2),
      'Closed': new BN(3)
    };

    return State[name];
  }

  function shouldChangeState(name) {
    const defaultState = 'Usual';

    context(`state ${name}`, function () {
      it('should change state and change to initial state', async function () {
        await this.contract[`switch${name}`]({ from: admin });
        expect(await crowdsale.state()).to.be.bignumber.equal(getStateByName(name));

        await this.contract[`switch${defaultState}`]({ from: admin });
        expect(await crowdsale.state()).to.be.bignumber.equal(getStateByName(defaultState));
      });

      it('should change state only admin', async function () {
        await this.contract[`switch${name}`]({ from: admin });
        expect(await crowdsale.state()).to.be.bignumber.equal(getStateByName(name));
      });
  
      it('shouldn`t change state not admin', async function () {
        await expectRevert(
          this.contract[`switch${name}`]({ from: anotherUserAccount }),
          'revert'
        );
      });

      it('emits a StateChanged event', async function () {
        const { logs } = await this.contract[`switch${name}`]({ from: admin });

        expectEvent.inLogs(logs, 'StateChanged', {
          currentState: name
        });
      });
    });
  }
});

function getBNwith10Pow(number, pow = 18) {
  return new BN(number).mul(new BN(10).pow(new BN(pow)));
}