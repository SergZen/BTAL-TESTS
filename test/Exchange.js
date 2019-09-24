/*jshint esversion: 6 */

const { BN, balance, ether, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
const { ZERO_ADDRESS } = constants;
const { expect } = require('chai');

const BTALToken = artifacts.require('./BTALToken.sol');
const Exchange = artifacts.require('./Exchange.sol');
const Crowdsale = artifacts.require('./Crowdsale.sol');

contract('Exchange', function (accounts) {
  const ZERO_AMOUNT = new BN(0);
  const hardcap = getBNwith10Pow(100000);
  const rate = getBNwith10Pow(40);
  const initialETHPrice = new BN(25000);
  const decimals = new BN(2);

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
  const userAccountAddress = anotherUserAccount;

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
    
    exchange = await Exchange.new(tokenContractAddress, crowdsaleСontractAddress, reserveAddress, { from: deployer });
    exchangeContractAddress = exchange.address;

    endTime = (await time.latest()).add(time.duration.weeks(1));
  });

  it('should be correct initialization exchange contract', async function () {
    expect(await exchange.BTAL()).to.equal(tokenContractAddress);
    expect(await exchange.crowdsale()).to.equal(crowdsaleСontractAddress);
    expect(await exchange.reserveAddress()).to.equal(reserveAddress);
  });

  describe('acceptETH', function () {
    it('should accept ether', async function () {
      const balanceTracker = await balance.tracker(exchangeContractAddress);
      const amount = ether('1');
  
      expect(await balanceTracker.delta()).to.be.bignumber.equal(ZERO_AMOUNT);
  
      await exchange.acceptETH({ value: amount, from: anotherUserAccount });
      expect(await balanceTracker.delta()).to.be.bignumber.equal(amount);
    });
  });

  describe('receiveApproval', function () {
    const from = anotherUserAccount;
    const weiAmount = ether('4');
    const purchaseTokensAmount = getBNwith10Pow(40000);

    const exchangeTokensAmount = getBNwith10Pow(10000);
    const exchangeWeiAmount = ether('2');
    
    const reserveTrigger = getBNwith10Pow(10000);
    const reverveLimit = new BN(500);
    
    beforeEach(async function () {
      await token.setCrowdsaleAddr(crowdsaleСontractAddress, { from: owner });
 
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

      await crowdsale.setReserveTrigger(reserveTrigger, { from: admin });
      await crowdsale.setReserveLimit(reverveLimit, { from: admin });

      await token.approve(exchangeContractAddress, exchangeTokensAmount, { from: from });
    });

    context('receiveApproval', function () {
      beforeEach(async function () {
        await crowdsale.addEnlisted(from, { from: admin });

        await crowdsale.sendTransaction({ value: weiAmount, from: from });
      });
      
      it('should do only for BTAL token', async function () {
        await exchange.receiveApproval(from, exchangeTokensAmount, tokenContractAddress, []);
      });
  
      it('shouldn`t do for another address', async function () {
        await expectRevert(
          exchange.receiveApproval(from, exchangeTokensAmount, anotherUserAccount, []),
          'revert'
        );
      });
    });

    describe('exchange', function () {
      context('when exchange in active state', function () {
        beforeEach(async function () {
          await crowdsale.sendTransaction({ value: weiAmount, from: from });
        });
  
        context('when account is not in private list', function () {
          it('reverts', async function () {
            await expectRevert(
              exchange.exchange(from, exchangeTokensAmount),
              'revert'
            );
          });
        });
  
        context('when account in private list', function () {
          beforeEach(async function () {
            await crowdsale.addEnlisted(from, { from: admin });
          });
  
          it('should exchange token to ether', async function () {
            const balanceUserBalance = await balance.current(from);
            const balanceExchangeBalance = await balance.current(exchangeContractAddress);

            expect(await token.balanceOf(from)).to.be.bignumber.equal(purchaseTokensAmount);
            expect(await token.balanceOf(reserveAddress)).to.be.bignumber.equal(ZERO_AMOUNT);

            await exchange.exchange(from, exchangeTokensAmount);

            expect(await balance.current(from)).to.be.bignumber.equal(balanceUserBalance.add(exchangeWeiAmount));
            expect(await balance.current(exchangeContractAddress)).to.be.bignumber.equal(balanceExchangeBalance.sub(exchangeWeiAmount));

            expect(await token.balanceOf(from)).to.be.bignumber.equal(purchaseTokensAmount.sub(exchangeTokensAmount));
            expect(await token.balanceOf(reserveAddress)).to.be.bignumber.equal(exchangeTokensAmount);
          });
    
          it('emits a Exchanged event', async function () {
            const { logs } = await exchange.exchange(from, exchangeTokensAmount);
           
            expectEvent.inLogs(logs, 'Exchanged', {
              user: from,
              tokenAmount: exchangeTokensAmount,
              weiAmount: exchangeWeiAmount
            });
          });
        });
      });
  
      context('when exchange is not active state', function () {
        it('reverts', async function () {
          await expectRevert(
            exchange.exchange(from, exchangeTokensAmount),
            'revert'
          );
        });
      });
  
      context('when account is not in private list', function () {
        it('reverts', async function () {
          await expectRevert(
            exchange.exchange(from, exchangeTokensAmount),
            'revert'
          );
        });
      });
    });
  });
 
  describe('finish', function () {
    context('by admin', function () {
      it('when token released', async function () {
        await token.setCrowdsaleAddr(crowdsaleСontractAddress, { from: owner });
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
        await crowdsale.sendTokens(exchangeContractAddress, hardcap, { from: admin });
        await token.release({ from: admin });

        const amount = ether('2');

        await exchange.acceptETH({ value: amount, from: anotherUserAccount });

        const reserveBalance = await balance.current(reserveAddress);
    
        await exchange.finish({ from: admin });

        expect(await balance.current(exchangeContractAddress)).to.be.bignumber.equal(ZERO_AMOUNT);
        expect(await balance.current(reserveAddress)).to.be.bignumber.equal(reserveBalance.add(amount));
      });

      it('when token is not released', async function () {
        await expectRevert(
          exchange.finish({ from: admin }),
          'revert'
        );
      });
    });

    context('by not admin', async function () {
      it('reverts', async function () {
        await expectRevert(
          exchange.finish({ from: anotherUserAccount }),
          'revert'
        );
      });      
    });
  });

  describe('setCrowdsaleAddr', function () {
    it('should set crowdsale as contact only admin', async function () {
      await exchange.setCrowdsaleAddr(crowdsaleСontractAddress, { from: admin });

      expect(await exchange.crowdsale()).to.equal(crowdsaleСontractAddress);
    });

    it('shouldn`t set crowdsale as user account', async function () {
      await expectRevert(
        exchange.setCrowdsaleAddr(anotherUserAccount, { from: admin }),
        'revert'
      );
    });

    it('shouldn`t set crowdsale not admin', async function () {
      await expectRevert(
        exchange.setCrowdsaleAddr(crowdsaleСontractAddress, { from: anotherUserAccount }),
        'revert'
      );
    });
  });

  describe('withdrawERC20', function () {
    describe('when the recipient is not the zero address', function () {
      it('should withdraw ERC20 only admin', async function () {
        const amount = new BN('1000000000');

        await token.mint(exchangeContractAddress, amount, { from: admin });
        expect(await token.balanceOf(exchangeContractAddress)).to.be.bignumber.equal(amount);
        expect(await token.balanceOf(userAccountAddress)).to.be.bignumber.equal('0');

        await exchange.withdrawERC20(tokenContractAddress, userAccountAddress, { from: admin });
        expect(await token.balanceOf(exchangeContractAddress)).to.be.bignumber.equal('0');
        expect(await token.balanceOf(userAccountAddress)).to.be.bignumber.equal(amount);
      });

      it('shouldn`t withdraw ERC20 not admin', async function () {
        await expectRevert(
          exchange.withdrawERC20(tokenContractAddress, anotherUserAccount, { from: anotherUserAccount }),
           'revert'
        );
      });

      it('shouldn`t withdraw ERC20 with zero balance', async function () {
        const emptyBalance = new BN(0);
        await expectRevert(
          exchange.withdrawERC20(tokenContractAddress, admin, { from: admin }),
          'revert'
        );
      });
    });

    describe('when the recipient is the zero address', function () {
      it('reverts', async function () {
        await expectRevert(
          exchange.withdrawERC20(tokenContractAddress, ZERO_ADDRESS, { from: admin }),
          'revert'
        );
      });
    });
  });
 
  describe('enlisted', function () {
    it('when address exchange contract', async function () {
      expect(await exchange.enlisted(exchangeContractAddress)).to.equal(true);
    });

    it('when address in PrivateList', async function () {
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
      await crowdsale.addEnlisted(anotherUserAccount, { from: admin });
      expect(await exchange.enlisted(anotherUserAccount)).to.equal(true);
    });

    it('when address is not in PrivateList', async function () {
      expect(await exchange.enlisted(anotherUserAccount)).to.equal(false);
    });
  });
  
  describe('getETHAmount', function () {
    const amount = ether('2');

    it('should be correct ETH amount', async function () {
      const amountTokens = getBNwith10Pow(10);

      await exchange.acceptETH({ value: amount, from: anotherUserAccount });

      expect(await exchange.getETHAmount(amountTokens)).to.be.bignumber.equal(new BN('200000000000'));
    });

    it('should be correct ETH amount for zero', async function () {
      const amountTokens = new BN(0);

      await exchange.acceptETH({ value: amount, from: anotherUserAccount });

      expect(await exchange.getETHAmount(amountTokens)).to.be.bignumber.equal(new BN('0'));
    });

    it('emits a BalanceIncreased event', async function () {
      const { logs } = await exchange.acceptETH({ value: amount, from: anotherUserAccount });

      expectEvent.inLogs(logs, 'BalanceIncreased', {
        user: anotherUserAccount,
        amount: amount
      });
    });
  });

  describe('fallback function', function () {
    const amount = ether('2');

    it('should be correct ETH amount', async function () {
      const amountTokens = getBNwith10Pow(10);

      await exchange.sendTransaction({ value: amount, from: anotherUserAccount });

      expect(await exchange.getETHAmount(amountTokens)).to.be.bignumber.equal(new BN('200000000000'));
    });

    it('should be correct ETH amount for zero', async function () {
      const amountTokens = new BN(0);

      await exchange.sendTransaction({ value: amount, from: anotherUserAccount });

      expect(await exchange.getETHAmount(amountTokens)).to.be.bignumber.equal(new BN('0'));
    });

    it('emits a BalanceIncreased event', async function () {
      const { logs } = await exchange.sendTransaction({ value: amount, from: anotherUserAccount });

      expectEvent.inLogs(logs, 'BalanceIncreased', {
        user: anotherUserAccount,
        amount: amount
      });
    });
  });
  


  describe('reserveAddress', function () {
    it('should have the reserve address', async function () {
      expect(await exchange.reserveAddress()).to.equal(reserveAddress);
    });
  });
});

function getBNwith10Pow(number, pow = 18) {
  return new BN(number).mul(new BN(10).pow(new BN(pow)));
}