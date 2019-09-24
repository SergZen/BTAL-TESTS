/*jshint esversion: 6 */

const { shouldBehaveLikePublicRole } = require('./roles/PublicRole.behavior');

const { BN, balance, ether, constants, expectEvent, expectRevert, time } = require('openzeppelin-test-helpers');
const { ZERO_ADDRESS } = constants;
const { expect } = require('chai');

const BTALToken = artifacts.require('./BTALToken.sol');
const Exchange = artifacts.require('./Exchange.sol');
const Crowdsale = artifacts.require('./Crowdsale.sol');

const ApproveAndCallFallBackMock = artifacts.require('./mocks/ApproveAndCallFallBackMock.sol');
const EmptyMock = artifacts.require('./mocks/EmptyMock.sol');

contract('Token', function (accounts) {
  const ZERO_AMOUNT = new BN(0);
  const tokenName = 'Bital Token';
  const tokenSymbol = 'BTAL';
  const tokenDecimals = new BN(18);
  const initialSupply = new BN(250000000).mul(new BN(10).pow(new BN(18)));

  const hardcapCrowdsale = getBNwith10Pow(100000);
  const rate = getBNwith10Pow(40);
  const initialETHPrice = new BN(25000);
  const decimals = new BN(2);

  let endTime;
  
  const hardcap = new BN(1000000000).mul(new BN(10).pow(new BN(18)));

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

  let anyContractAddress;
  let tokenContractAddress;
  let crowdsaleСontractAddress;
  let exchangeContractAddress;

  beforeEach(async function () {
    token = await BTALToken.new(initialHolder, owner, { from: deployer });
    this.contract = token;

    anyContractAddress = token.address;
    tokenContractAddress = token.address;

    crowdsale = await Crowdsale.new({ from: deployer });
    crowdsaleСontractAddress = crowdsale.address;   
    
    exchange = await Exchange.new(tokenContractAddress, crowdsaleСontractAddress, reserveAddress, { from: deployer });
    exchangeContractAddress = exchange.address;

    endTime = (await time.latest()).add(time.duration.weeks(1));
  });

  describe("Ownable:", function () {
    it('should have an owner', async function () {
      expect(await token.owner()).to.equal(owner);
    });
      
    it('changes owner after transfer', async function () {
      expect(await token.isOwner(anotherUserAccount, { from: anotherUserAccount })).to.equal(false);
      const { logs } = await token.transferOwnership(anotherUserAccount, { from: owner });
      expectEvent.inLogs(logs, 'OwnershipTransferred');
      
      expect(await token.owner()).to.equal(anotherUserAccount);
      expect(await token.isOwner(anotherUserAccount, { from: anotherUserAccount })).to.equal(true);
    });
      
    it('should prevent non-owners from transferring', async function () {
      await expectRevert(
        token.transferOwnership(anotherUserAccount, { from: anotherUserAccount }),
        'Caller has no permission'
      );
    });
      
    it('should guard ownership against stuck state', async function () {
      await expectRevert(
        token.transferOwnership(ZERO_ADDRESS, { from: owner }),
        'New owner is the zero address'
      );
    });
      
    it('loses owner after renouncement', async function () {
      const { logs } = await token.renounceOwnership({ from: owner });
      expectEvent.inLogs(logs, 'OwnershipTransferred');
      
      expect(await token.owner()).to.equal(ZERO_ADDRESS);
    });
      
    it('should prevent non-owners from renouncement', async function () {
      await expectRevert(
        token.renounceOwnership({ from: anotherUserAccount }),
        'Caller has no permission'
      );
    });
  });

  describe("ERC20:", function () {
    describe('total supply', function () {
      it('returns the total amount of tokens', async function () {
        expect(await token.totalSupply()).to.be.bignumber.equal(initialSupply);
      });
    });
        
    describe('balanceOf', function () {
      describe('when the requested account has no tokens', function () {
        it('returns zero', async function () {
          expect(await token.balanceOf(anotherUserAccount)).to.be.bignumber.equal("0");
        });
      });
        
      describe('when the requested account has some tokens', function () {
        it('returns the total amount of tokens', async function () {
          expect(await token.balanceOf(initialHolder)).to.be.bignumber.equal(initialSupply);
        });
      });
    });
        
    describe('transfer', function () {
      const from = initialHolder;
      const to = anotherUserAccount;

      describe('when the recipient is not the zero address', function () {
        
        describe('when the sender does not have enough balance', function () {
          const amount = initialSupply.addn(1);
    
          it('reverts', async function () {
            await expectRevert(
              token.transfer(to, amount, { from: from }),
              'revert'
            );
          });
        });
    
        describe('when the sender transfers all balance', function () {
          const amount = initialSupply;
    
          it('transfers the requested amount', async function () {
            await token.transfer(to, amount, { from: from });
    
            expect(await token.balanceOf(from)).to.be.bignumber.equal('0');
    
            expect(await token.balanceOf(to)).to.be.bignumber.equal(amount);
          });
    
          it('emits a transfer event', async function () {
            const { logs } = await token.transfer(to, amount, { from: from });
            
            expectEvent.inLogs(logs, 'Transfer', {
              from: from,
              to: to,
              value: amount
            });
          });
        });
    
        describe('when the sender transfers zero tokens', function () {
          const amount = new BN('0');
    
          it('transfers the requested amount', async function () {
            await token.transfer(to, amount, { from: from });
    
            expect(await token.balanceOf(from)).to.be.bignumber.equal(initialSupply);
    
            expect(await token.balanceOf(to)).to.be.bignumber.equal('0');
          });
    
          it('emits a transfer event', async function () {
            const { logs } = await token.transfer(to, amount, { from: from });
    
            expectEvent.inLogs(logs, 'Transfer', {
              from: from,
              to: to,
              value: amount
            });
          });
        });

        describe('when the sender has locked tokens', function () {
          const lockedTokensAmount = getBNwith10Pow(1000);
          let transferedTokensAmount;
          let notTransferedTokensAmount;

          const lockTime = 86400;
  
          beforeEach(async function () {
            const reserveTrigger = getBNwith10Pow(10000);
            const reverveLimit = new BN(500);

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

            await crowdsale.sendTransaction({ value: ether('2'), from: tokenBuyer2 });

            await token.lock(from, lockedTokensAmount, lockTime, { from: admin });

            transferedTokensAmount = (await token.balanceOf(from)).sub(lockedTokensAmount);
            notTransferedTokensAmount = transferedTokensAmount.addn(1);
          });
  
          context('token wasn`t released', function () {
            context('sender isn`t admin', function () {
              context('sender hasn`t unlocked tokens', function () {
                context('exists exchange address', function () {
                  beforeEach(async function () {
                    await token.setExchangeAddr(exchangeContractAddress, { from: admin });
                  });

                  context('sender is private list', function () {
                    beforeEach(async function () {
                      await crowdsale.addEnlisted(from, { from: admin });
                    });

                    it('should transfer unlocked amount to exchange', async function () {
                      const exchangedTokensAmount = getBNwith10Pow(10000);

                      await crowdsale.sendTransaction({ value: ether('2'), from: from });

                      await token.transfer(exchangeContractAddress, exchangedTokensAmount, { from: from });
                      expect(await token.balanceOf(reserveAddress)).to.be.bignumber.equal(exchangedTokensAmount);
                    });
                    
                    it('should transfer unlocked amount to reserve address', async function () {
                      await token.transfer(reserveAddress, transferedTokensAmount, { from: from });
                      expect(await token.balanceOf(reserveAddress)).to.be.bignumber.equal(transferedTokensAmount);
                    });

                    it('shouldn`t transfer unlocked amount to other address', async function () {
                      await expectRevert(
                        token.transfer(to, transferedTokensAmount, { from: from }),
                        'revert'
                      );
                    });
                    
                    it('shouldn`t transfer more then more unlocked amount to any address', async function () {
                      await expectRevert(
                        token.transfer(to, notTransferedTokensAmount, { from: from }),
                        'revert'
                      );
                    }); 
                  });

                  context('sender isn`t private list', function () {
                    it('reverts', async function () {
                      await expectRevert(
                        token.transfer(to, transferedTokensAmount, { from: from }),
                        'revert'
                      );
                    });                  
                  });
                });
  
                context('don`t exist exchange address', function () {
                  it('should transfer unlocked amount to any address', async function () {
                    await token.transfer(to, transferedTokensAmount, { from: from });
                    expect(await token.balanceOf(to)).to.be.bignumber.equal(transferedTokensAmount);
                  });

                  it('shouldn`t transfer more then more unlocked amount to any address', async function () {
                    await expectRevert(
                      token.transfer(to, notTransferedTokensAmount, { from: from }),
                      'revert'
                    );
                  }); 
                });
              });
  
              context('has unlocked tokens', function () {
                beforeEach(async function () {
                  await token.setExchangeAddr(exchangeContractAddress, { from: admin });
                  await token.unlock(from, { from: admin });
                });

                it('should transfer unlocked amount to any address', async function () {
                  await token.transfer(to, transferedTokensAmount, { from: from });
                  expect(await token.balanceOf(to)).to.be.bignumber.equal(transferedTokensAmount);
                });
              });
            });
  
            context('sender is admin', function () {
              beforeEach(async function () {
                await token.setExchangeAddr(exchangeContractAddress, { from: admin });
                await token.addAdmin(from, { from: owner });
              });
             
              it('should transfer unlocked amount to any address', async function () {
                await token.transfer(to, transferedTokensAmount, { from: from });
                expect(await token.balanceOf(to)).to.be.bignumber.equal(transferedTokensAmount);
              });

              it('shouldn`t transfer more then more unlocked amount to any address', async function () {
                await expectRevert(
                  token.transfer(to, notTransferedTokensAmount, { from: from }),
                  'revert'
                );
              });
            });
          });
  
          context('token was released', function () {
            beforeEach(async function () {
              const endTime = (await time.latest()).sub(time.duration.hours(1));
              await crowdsale.setEndTime(endTime, { from: admin });
              await token.setExchangeAddr(exchangeContractAddress, { from: admin });           
              await token.release({ from: admin });
            });

            it('should transfer unlocked amount to any address', async function () {
              await token.transfer(to, transferedTokensAmount, { from: from });
              expect(await token.balanceOf(to)).to.be.bignumber.equal(transferedTokensAmount);
            });

            it('shouldn`t transfer more then more unlocked amount to any address', async function () {
              await expectRevert(
                token.transfer(to, notTransferedTokensAmount, { from: from }),
                'revert'
              );
            });
          });
        });
      });
    
       describe('when the recipient is the zero address', function () {
         it('reverts', async function () {
           await expectRevert(
             token.transfer(ZERO_ADDRESS, initialSupply, { from: from }),
             'revert'
           );
         });
       });

       describe('when the recipient is the contract address', function () {
         const amount = initialSupply;

         let contractAddress;

         context('contract address supports ApproveAndCallFallBack', function () {
           let approveAndCallFallBackMock;

           beforeEach(async function () {
             approveAndCallFallBackMock = await ApproveAndCallFallBackMock.new({ from: deployer });
             contractAddress = approveAndCallFallBackMock.address;
           });

           context('registred contract', function () {
             beforeEach(async function () {
               await token.registerContract(contractAddress, { from: admin });
             });

             it('transfers the requested amount', async function () {
               await token.transfer(contractAddress, amount, { from });
  
               expect(await token.balanceOf(from)).to.be.bignumber.equal('0');
               expect(await token.balanceOf(contractAddress)).to.be.bignumber.equal(amount);
             });

             it('emits a transfer event', async function () {
               const { logs } = await token.transfer(contractAddress, amount, { from });
              
               expectEvent.inLogs(logs, 'Transfer', {
                 from: from,
                 to: contractAddress,
                 value: amount
               });
             });
           });

           context('unregistred contract', function () {
             it('transfers the requested amount', async function () {
               await token.transfer(contractAddress, amount, { from });
    
               expect(await token.balanceOf(from)).to.be.bignumber.equal('0');
               expect(await token.balanceOf(contractAddress)).to.be.bignumber.equal(amount);
             });
           });
         });

         context('contract address doesn`t support ApproveAndCallFallBack', function () {
           it('reverts', async function () {
             const emptyMock = await EmptyMock.new({ from: deployer });
             const contractAddress = emptyMock.address;

             await token.registerContract(contractAddress, { from: admin });

             await expectRevert(
               token.transfer(emptyMock.address, initialSupply, { from: from }),
               'revert'
             );
           });
         });
       });
    });
        
    describe('transfer from', function () {
      const spender = anotherUserAccount;
        
      describe('when the token owner is not the zero address', function () {
        const tokenOwner = initialHolder;
        
        describe('when the recipient is not the zero address', function () {
          const to = owner;
        
          describe('when the spender has enough approved balance', function () {
            beforeEach(async function () {
              await token.approve(spender, initialSupply, { from: initialHolder });
            });
        
            describe('when the token owner has enough balance', function () {
              const amount = initialSupply;
        
              it('transfers the requested amount to user account', async function () {
                await token.transferFrom(tokenOwner, to, amount, { from: spender });
                expect(await token.balanceOf(tokenOwner)).to.be.bignumber.equal('0');
                expect(await token.balanceOf(to)).to.be.bignumber.equal(amount);
              });
        
              it('decreases the spender allowance', async function () {
                await token.transferFrom(tokenOwner, to, amount, { from: spender });
                expect(await token.allowance(tokenOwner, spender)).to.be.bignumber.equal('0');
              });
        
              it('emits a transfer event', async function () {
                const { logs } = await token.transferFrom(tokenOwner, to, amount, { from: spender });
        
                expectEvent.inLogs(logs, 'Transfer', {
                  from: tokenOwner,
                  to: to,
                  value: amount
                });
              });
        
              it('emits an approval event', async function () {
                const { logs } = await token.transferFrom(tokenOwner, to, amount, { from: spender });
                const allowance = await token.allowance(tokenOwner, spender);
        
                expectEvent.inLogs(logs, 'Approval', {
                  owner: tokenOwner,
                  spender: spender,
                  value: allowance
                });
              });
            });
        
            describe('when the token owner does not have enough balance', function () {
              const amount = initialSupply.addn(1);
        
              it('reverts', async function () {
                await expectRevert(
                  token.transferFrom(tokenOwner, to, amount, { from: spender }), 
                  'revert'
                );
              });
            });
          });
        
          describe('when the spender does not have enough approved balance', function () {
            beforeEach(async function () {
              await token.approve(spender, initialSupply.subn(1), { from: tokenOwner });
            });
        
            describe('when the token owner has enough balance', function () {
              const amount = initialSupply;
        
              it('reverts', async function () {
                await expectRevert(
                  token.transferFrom(tokenOwner, to, amount, { from: spender }), 
                  'revert'
                );
              });
            });
        
            describe('when the token owner does not have enough balance', function () {
              const amount = initialSupply.addn(1);
        
              it('reverts', async function () {
                await expectRevert(
                  token.transferFrom(tokenOwner, to, amount, { from: spender }), 
                  'revert'
                );
              });
            });
          });

          describe('when the sender has locked tokens', function () {
            const from = tokenOwner;
            const lockedTokensAmount = getBNwith10Pow(1000);
            const lockTime = 86400;

            let transferedTokensAmount;
            let notTransferedTokensAmount;
         
            beforeEach(async function () {
              const reserveTrigger = getBNwith10Pow(10000);
              const reverveLimit = new BN(500);

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
        
              await crowdsale.sendTransaction({ value: ether('2'), from: from });
        
              await token.lock(from, lockedTokensAmount, lockTime, { from: admin });

              transferedTokensAmount = (await token.balanceOf(from)).sub(lockedTokensAmount);
              notTransferedTokensAmount = transferedTokensAmount.addn(1);

              await token.approve(from, transferedTokensAmount, { from: from });
            });
          
            context('token wasn`t released', function () {
              context('sender isn`t admin', function () {
                context('sender hasn`t unlocked tokens', function () {
                  context('exists exchange address', function () {
                    beforeEach(async function () {
                      await token.setExchangeAddr(exchangeContractAddress, { from: admin });
                    });
        
                    context('sender is private list', function () {
                      beforeEach(async function () {
                        await crowdsale.addEnlisted(from, { from: admin });
                      });
        
                      it('should transfer unlocked amount to exchange', async function () {
                        const exchangedTokensAmount = getBNwith10Pow(10000);
                        await token.approve(exchangeContractAddress, exchangedTokensAmount, { from: from });

                        await crowdsale.setBonusPercent(ZERO_AMOUNT, { from: admin });
                        await crowdsale.sendTransaction({ value: ether('2'), from: from });
 
                        await token.transferFrom(from, exchangeContractAddress, exchangedTokensAmount, { from: from });
                        expect(await token.balanceOf(reserveAddress)).to.be.bignumber.equal(exchangedTokensAmount);
                      });
                            
                      it('should transfer unlocked amount to reserve address', async function () {
                        await token.transferFrom(from, reserveAddress, transferedTokensAmount, { from: from });
                        expect(await token.balanceOf(reserveAddress)).to.be.bignumber.equal(transferedTokensAmount);
                      });
        
                      it('shouldn`t transfer unlocked amount to other address', async function () {
                        await expectRevert(
                          token.transferFrom(from, anotherUserAccount, transferedTokensAmount, { from: from }),
                          'revert'
                        );
                      });
                            
                      it('shouldn`t transfer more then more unlocked amount to any address', async function () {
                        await expectRevert(
                          token.transferFrom(from, anotherUserAccount, notTransferedTokensAmount, { from: from }),
                          'revert'
                        );
                      }); 
                    });
        
                    context('sender isn`t private list', function () {
                      it('reverts', async function () {
                        await expectRevert(
                          token.transferFrom(from, to, transferedTokensAmount, { from: from }),
                          'revert'
                        );
                      });                  
                    });
                  });
          
                  context('don`t exist exchange address', function () {
                    it('should transfer unlocked amount to any address', async function () {
                      await token.transferFrom(from, to, transferedTokensAmount, { from: from });
                      expect(await token.balanceOf(to)).to.be.bignumber.equal(transferedTokensAmount);
                    });
        
                    it('shouldn`t transfer more then more unlocked amount to any address', async function () {
                      await expectRevert(
                        token.transferFrom(from, to, notTransferedTokensAmount, { from: from }),
                        'revert'
                      );
                    }); 
                  });
                });
          
                context('has unlocked tokens', function () {
                  beforeEach(async function () {
                    await token.setExchangeAddr(exchangeContractAddress, { from: admin });
                    await token.unlock(from, { from: admin });
                  });
        
                  it('should transfer unlocked amount to any address', async function () {
                    await token.transferFrom(from, to, transferedTokensAmount, { from: from });
                    expect(await token.balanceOf(to)).to.be.bignumber.equal(transferedTokensAmount);
                  });
                });
              });
          
              context('sender is admin', function () {
                beforeEach(async function () {
                  await token.setExchangeAddr(exchangeContractAddress, { from: admin });
                  await token.addAdmin(from, { from: owner });
                });
                     
                it('should transfer unlocked amount to any address', async function () {
                  await token.transferFrom(from, to, transferedTokensAmount, { from: from });
                  expect(await token.balanceOf(to)).to.be.bignumber.equal(transferedTokensAmount);
                });
        
                it('shouldn`t transfer more then more unlocked amount to any address', async function () {
                  await expectRevert(
                    token.transferFrom(from, to, notTransferedTokensAmount, { from: from }),
                    'revert'
                  );
                });
              });
            });
          
            context('token was released', function () {
              beforeEach(async function () {
                const endTime = (await time.latest()).sub(time.duration.hours(1));
                await crowdsale.setEndTime(endTime, { from: admin });
                await token.release({ from: admin });
              });
        
              it('should transfer unlocked amount to any address', async function () {
                await token.transferFrom(from, to, transferedTokensAmount, { from: from });
                expect(await token.balanceOf(to)).to.be.bignumber.equal(transferedTokensAmount);
              });
        
              it('shouldn`t transfer more then more unlocked amount to any address', async function () {
                await expectRevert(
                  token.transferFrom(from, to, notTransferedTokensAmount, { from: from }),
                  'revert'
                );
              });
            });
          });
        });
        
        describe('when the recipient is the zero address', function () {
          const amount = initialSupply;
          const to = ZERO_ADDRESS;
        
          beforeEach(async function () {
            await token.approve(spender, amount, { from: tokenOwner });
          });
        
          it('reverts', async function () {
            await expectRevert(
              token.transferFrom(tokenOwner, to, amount, { from: spender }), 
              'revert'
            );
          });
        });
      });
        
      describe('when the token owner is the zero address', function () {
        const amount = 0;
        const tokenOwner = ZERO_ADDRESS;
        const to = initialHolder;
        
        it('reverts', async function () {
          await expectRevert(
            token.transferFrom(tokenOwner, to, amount, { from: spender }), 
            'revert'
          );
        });
      });

      describe('when the recipient is the contract address', function () {
        const amount = initialSupply;
        const spender = initialHolder;

        let contractAddress;

        context('contract address supports ApproveAndCallFallBack', function () {
          let approveAndCallFallBackMock;

          beforeEach(async function () {
            approveAndCallFallBackMock = await ApproveAndCallFallBackMock.new({ from: deployer });
            contractAddress = approveAndCallFallBackMock.address;
            await token.approve(contractAddress, amount, { from: spender });
          });

          context('registred contract', function () {
            beforeEach(async function () {
               await token.registerContract(contractAddress, { from: admin });
            });

            it('transfers the requested amount', async function () {
              await token.transferFrom(spender, contractAddress, amount, { from: spender });
  
              expect(await token.balanceOf(spender)).to.be.bignumber.equal('0');
              expect(await token.balanceOf(contractAddress)).to.be.bignumber.equal(amount);
            });

            it('emits a transfer event', async function () {
              const { logs } = await token.transferFrom(spender, contractAddress, amount, { from: spender });
             
              expectEvent.inLogs(logs, 'Transfer', {
                from: spender,
                to: contractAddress,
                value: amount
              });
            });
          });

          context('unregistred contract', function () {
            it('transfers the requested amount', async function () {
              await token.approve(spender, amount, { from: spender });
              await token.transferFrom(spender, contractAddress, amount, { from: spender });
  
              expect(await token.balanceOf(spender)).to.be.bignumber.equal('0');
              expect(await token.balanceOf(contractAddress)).to.be.bignumber.equal(amount);
            });
          });
        });

         context('contract address doesn`t support ApproveAndCallFallBack', function () {
           it('reverts', async function () {
             const emptyMock = await EmptyMock.new({ from: deployer });
             const contractAddress = emptyMock.address;

             await token.registerContract(contractAddress, { from: admin });
             await token.approve(contractAddress, amount, { from: spender });

             await expectRevert(
               token.transferFrom(spender, contractAddress, amount, { from: spender }),
               'revert'
             );
           });
         });
       });
    });

    describe('approve', function () {
      const spender = anotherUserAccount;
      const tokenOwner = initialHolder;

      describe('when the spender is not the zero address', function () {
        describe('when the sender has enough balance', function () {
          const amount = initialSupply;
   
          it('emits an approval event', async function () {
            const { logs } = await token.approve(spender, amount, { from: tokenOwner });
   
            expectEvent.inLogs(logs, 'Approval', {
              owner: tokenOwner,
              spender: spender,
              value: amount
            });
          });
   
          describe('when there was no approved amount before', function () {
            it('approves the requested amount', async function () {
              await token.approve(spender, amount, { from: tokenOwner });
   
              expect(await token.allowance(tokenOwner, spender)).to.be.bignumber.equal(amount);
            });
          });
   
          describe('when the spender had an approved amount', function () {
            beforeEach(async function () {
              await token.approve(spender, new BN(1), { from: tokenOwner });
            });
   
            it('approves the requested amount and replaces the previous one', async function () {
              await token.approve(spender, amount, { from: tokenOwner });
   
              expect(await token.allowance(tokenOwner, spender)).to.be.bignumber.equal(amount);
            });
          });
        });
   
        describe('when the sender does not have enough balance', function () {
          const amount = initialSupply.addn(1);
   
          it('emits an approval event', async function () {
            const { logs } = await token.approve(spender, amount, { from: tokenOwner });
   
            expectEvent.inLogs(logs, 'Approval', {
              owner: tokenOwner,
              spender: spender,
              value: amount
            });
          });
   
          describe('when there was no approved amount before', function () {
            it('approves the requested amount', async function () {
              await token.approve(spender, amount, { from: tokenOwner });
   
              expect(await token.allowance(tokenOwner, spender)).to.be.bignumber.equal(amount);
            });
          });
   
          describe('when the spender had an approved amount', function () {
            beforeEach(async function () {
              await token.approve(spender, new BN(1), { from: tokenOwner });
            });
   
            it('approves the requested amount and replaces the previous one', async function () {
              await token.approve(spender, amount, { from: tokenOwner });
   
              expect(await token.allowance(tokenOwner, spender)).to.be.bignumber.equal(amount);
            });
          });
        });
      });
   
      describe('when the spender is the zero address', function () {
        it('reverts', async function () {
          await expectRevert(
            token.approve(ZERO_ADDRESS, initialSupply, { from: tokenOwner }),
            'revert'
          );
        });
      });
    });

    describe('decrease allowance', function () {
      describe('when the spender is not the zero address', function () {
        const spender = initialHolder;
 
        function shouldDecreaseApproval (amount) {
          describe('when there was no approved amount before', function () {
            it('reverts', async function () {
              await expectRevert(
                token.decreaseAllowance(spender, amount, { from: initialHolder }), 
                'revert'
              );
            });
          });
 
          describe('when the spender had an approved amount', function () {
            const approvedAmount = amount;
 
            beforeEach(async function () {
              ({ logs: this.logs } = await token.approve(spender, approvedAmount, { from: initialHolder }));
            });
 
            it('emits an approval event', async function () {
              const { logs } = await token.decreaseAllowance(spender, approvedAmount, { from: initialHolder });
 
              expectEvent.inLogs(logs, 'Approval', {
                owner: initialHolder,
                spender: spender,
                value: new BN(0),
              });
            });
 
            it('decreases the spender allowance subtracting the requested amount', async function () {
              await token.decreaseAllowance(spender, approvedAmount.subn(1), { from: initialHolder });
 
              expect(await token.allowance(initialHolder, spender)).to.be.bignumber.equal('1');
            });
 
            it('sets the allowance to zero when all allowance is removed', async function () {
              await token.decreaseAllowance(spender, approvedAmount, { from: initialHolder });
              expect(await token.allowance(initialHolder, spender)).to.be.bignumber.equal('0');
            });
 
            it('reverts when more than the full allowance is removed', async function () {
              await expectRevert(
                token.decreaseAllowance(spender, approvedAmount.addn(1), { from: initialHolder }),
                'revert'
              );
            });
          });
        }
 
        describe('when the sender has enough balance', function () {
          const amount = initialSupply;
 
          shouldDecreaseApproval(amount);
        });
 
        describe('when the sender does not have enough balance', function () {
          const amount = initialSupply.addn(1);
 
          shouldDecreaseApproval(amount);
        });
      });
 
      describe('when the spender is the zero address', function () {
        const amount = initialSupply;
        const spender = ZERO_ADDRESS;
 
        it('reverts', async function () {
          await expectRevert(
            token.decreaseAllowance(spender, amount, { from: initialHolder }), 
            'revert'
          );
        });
      });
    });
 
    describe('increase allowance', function () {
      const amount = initialSupply;
 
      describe('when the spender is not the zero address', function () {
        const spender = initialHolder;
 
        describe('when the sender has enough balance', function () {
          it('emits an approval event', async function () {
            const { logs } = await token.increaseAllowance(spender, amount, { from: initialHolder });
 
            expectEvent.inLogs(logs, 'Approval', {
              owner: initialHolder,
              spender: spender,
              value: amount,
            });
          });
 
          describe('when there was no approved amount before', function () {
            it('approves the requested amount', async function () {
              await token.increaseAllowance(spender, amount, { from: initialHolder });
 
              expect(await token.allowance(initialHolder, spender)).to.be.bignumber.equal(amount);
            });
          });
 
          describe('when the spender had an approved amount', function () {
            beforeEach(async function () {
              await token.approve(spender, new BN(1), { from: initialHolder });
            });
 
            it('increases the spender allowance adding the requested amount', async function () {
              await token.increaseAllowance(spender, amount, { from: initialHolder });
 
              expect(await token.allowance(initialHolder, spender)).to.be.bignumber.equal(amount.addn(1));
            });
          });
        });
 
        describe('when the sender does not have enough balance', function () {
          const amount = initialSupply.addn(1);
 
          it('emits an approval event', async function () {
            const { logs } = await token.increaseAllowance(spender, amount, { from: initialHolder });
 
            expectEvent.inLogs(logs, 'Approval', {
              owner: initialHolder,
              spender: spender,
              value: amount,
            });
          });
 
          describe('when there was no approved amount before', function () {
            it('approves the requested amount', async function () {
              await token.increaseAllowance(spender, amount, { from: initialHolder });
 
              expect(await token.allowance(initialHolder, spender)).to.be.bignumber.equal(amount);
            });
          });
 
          describe('when the spender had an approved amount', function () {
            beforeEach(async function () {
              await token.approve(spender, new BN(1), { from: initialHolder });
            });
 
            it('increases the spender allowance adding the requested amount', async function () {
              await token.increaseAllowance(spender, amount, { from: initialHolder });
 
              expect(await token.allowance(initialHolder, spender)).to.be.bignumber.equal(amount.addn(1));
            });
          });
        });
      });
 
      describe('when the spender is the zero address', function () {
        const spender = ZERO_ADDRESS;
 
        it('reverts', async function () {
          await expectRevert(
            token.increaseAllowance(spender, amount, { from: initialHolder }), 
            'revert'
          );
        });
      });
    });
  });

  describe("MinterRole:", async function () {
    const minter = admin;
    const otherMinter = initialHolder;
    const other = [anotherUserAccount];

    beforeEach(async function () {
      await token.addMinter(otherMinter, { from: owner });
    });

    it('owner should be minter', async function () {
      expect(await token[`isMinter`](owner)).to.equal(true);
    });

    shouldBehaveLikePublicRole(minter, otherMinter, other, 'Minter', owner);
  });

  describe("ERC20Mintable:", function () {
    const minter = admin;
    const other = anotherUserAccount;

    describe('as a mintable token', function () {
      describe('mint', function () {
        const amount = new BN(100);
 
        context('when the sender has minting permission', function () {
          const from = minter;
 
          context('for a zero amount', function () {
            shouldMint(new BN(0));
          });
 
          context('for a non-zero amount', function () {
            shouldMint(amount);
          });
 
          function shouldMint (amount) {
            beforeEach(async function () {
              ({ logs: this.logs } = await token.mint(other, amount, { from }));
            });
 
            it('mints the requested amount', async function () {
              expect(await token.balanceOf(other)).to.be.bignumber.equal(amount);
            });
 
            it('emits a mint and a transfer event', async function () {
              expectEvent.inLogs(this.logs, 'Transfer', {
                from: ZERO_ADDRESS,
                to: other,
                value: amount,
              });
            });
          }
        });
 
        context('when the sender doesn\'t have minting permission', function () {
          const from = anotherUserAccount;
 
          it('reverts', async function () {
            await expectRevert(
              token.mint(other, amount, { from }),
              'Caller has no permission'
            );
          });
        });
      });
    });
  });

  describe("AdminRole:", function () {
    const otherAdmin = initialHolder;
    const other = [anotherUserAccount];

    beforeEach(async function () {
      await token.addAdmin(otherAdmin, { from: owner });
    });

    it('owner should be admin', async function () {
      expect(await token[`isAdmin`](owner)).to.equal(true);
    });

    shouldBehaveLikePublicRole(admin, otherAdmin, other, 'Admin', owner);
  });

  describe("LockableToken:", function () {
    describe('lock', function () {
      const amount = new BN('10000000');
      const lockTime = 86400;

      describe('when the recipient is not the zero address', function () {
        it('should lock token only admin', async function () {
          await token.lock(anotherUserAccount, amount, lockTime, { from: admin });
        });

        it('shouldn`t lock token with zero balance', async function () {
          await expectRevert(
            token.lock(anotherUserAccount, 0, lockTime, { from: admin }),
            'revert'
          );
        });
 
        it('shouldn`t lock token not admin', async function () {
          await expectRevert(
            token.lock(anotherUserAccount, amount, lockTime, { from: anotherUserAccount }),
            'Caller has no permission'
          );
        });
      });

      describe('when the recipient is the zero address', function () {
        it('reverts', async function () {
          await expectRevert(
            token.lock(ZERO_ADDRESS, amount, lockTime, { from: admin }),
            'revert'
          );
        });
      }); 
    });

    describe('unlock', function () {
      describe('when the recipient is not the zero address', function () {
        it('should unlock token only admin', async function () {
          await token.unlock(anotherUserAccount, { from: admin });
        });
 
        it('shouldn`t unlock token not admin', async function () {
          await expectRevert(
            token.unlock(anotherUserAccount, { from: anotherUserAccount }),
            'Caller has no permission'
          );
        });
      });

      describe('when the recipient is the zero address', function () {
        it('reverts', async function () {
          await expectRevert(
            token.unlock(ZERO_ADDRESS, { from: admin }),
            'revert'
          );
        });
      });
    });

    describe('unlock list', function () {
      const accountList = accounts;
      const accountListWithZeroAddress = [ZERO_ADDRESS, accounts[0]];

      it('should unlock list only admin', async function () {
        await token.unlockList(accountList, { from: admin });
      });

      it('shouldn`t unlock list not admin', async function () {
        await expectRevert(
          token.unlockList(accountList, { from: anotherUserAccount }),
          'Caller has no permission'
        );
      });

      it('shouldn`t unlock list with zero address', async function () {
        await expectRevert(
          token.unlockList(accountListWithZeroAddress, { from: admin }),
          'revert'
        );
      });
    });

    describe('release', function () {
      context('admin', function () {
        context('crowdsale address was set', function () {
          beforeEach(async function () {
            await token.setCrowdsaleAddr(crowdsaleСontractAddress, { from: owner });

            const walletAddress = accounts[7];
            const teamAddress = accounts[8];

            const hardcap = getBNwith10Pow(10000);


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
              hardcapCrowdsale
            );
          });

          it('should release when crowdsale hardcap reached', async function () {
            const crowdsaleHardCap = await crowdsale.hardcap();
            await crowdsale.sendTokens(anotherUserAccount, crowdsaleHardCap, { from: admin });

            expect(await token.released()).to.equal(false);

            await token.release({ from: admin });
           
            expect(await token.released()).to.equal(true);
            expect(await token.crowdsale()).to.equal(ZERO_ADDRESS);
          });
     
          it('should release when crowdsale end time reached', async function () {
            const endTime = (await time.latest()).sub(time.duration.hours(1));
           
            await crowdsale.setEndTime(endTime, { from: admin });
     
            expect(await token.released()).to.equal(false);

            await token.release({ from: admin });
           
            expect(await token.released()).to.equal(true);
            expect(await token.crowdsale()).to.equal(ZERO_ADDRESS);
          });
   
          it('shouldn`t release when crowdsale hardcap and end time not reached', async function () {
            await expectRevert(
              token.release({ from: admin }),
              'revert'
            );
          });
        });

        context('crowdsale address wasn`t set', function () {
          it('should release when crowdsale address as zero address', async function () {
            expect(await token.released()).to.equal(false);
            expect(await token.crowdsale()).to.equal(ZERO_ADDRESS);

            await token.release({ from: admin });
           
            expect(await token.released()).to.equal(true);
            expect(await token.crowdsale()).to.equal(ZERO_ADDRESS);
          });
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

    describe('crowdsale', function () {
      it('should set crowdsale as contact only admin', async function () {
        await token.setCrowdsaleAddr(crowdsaleСontractAddress, { from: admin });

        expect(await token.crowdsale()).to.equal(crowdsaleСontractAddress);
        expect(await token.isAdmin(crowdsaleСontractAddress)).to.equal(true);
        expect(await token.isMinter(crowdsaleСontractAddress)).to.equal(true);
      });

      it('shouldn`t set crowdsale as user account', async function () {
        await expectRevert(
          token.setCrowdsaleAddr(anotherUserAccount, { from: admin }),
          'revert'
        );
      });

      it('shouldn`t set crowdsale not admin', async function () {
        await expectRevert(
          token.setCrowdsaleAddr(crowdsaleСontractAddress, { from: anotherUserAccount }),
          'Caller has no permission'
        );
      });
    });
  });

  describe("BTALToken:", function () {
    describe('correct initialization', function () {
      it('has a hardcap', async function () {
        expect(await token.hardcap()).to.be.bignumber.equal(hardcap);
      });
 
      it('emits events during construction', async function () {
        await expectEvent.inConstruction(token, 'OwnershipTransferred', {
          previousOwner: ZERO_ADDRESS,
          newOwner: owner
        });

        await expectEvent.inConstruction(token, 'MinterAdded', {
          account: owner,
        });

        await expectEvent.inConstruction(token, 'AdminAdded', {
          account: owner,
        });

        await expectEvent.inConstruction(token, 'Transfer', {
          from: ZERO_ADDRESS,
          to: initialHolder,
          value: initialSupply
        });
      });
    });

    describe('ERC20Detailed', function () {
      it('has a name', async function () {
        expect(await token.name()).to.equal(tokenName);
      });
       
      it('has a symbol', async function () {
        expect(await token.symbol()).to.equal(tokenSymbol);
      });
       
      it('has an amount of decimals', async function () {
        expect(await token.decimals()).to.be.bignumber.equal(tokenDecimals);
      });
    });

    describe('isContract', function () {
      it('should return false for account address', async function () {
        expect(await token.isContract(anotherUserAccount)).to.equal(false);
      });
 
      it('should return true for contract address', async function () {
        expect(await token.isContract(anyContractAddress)).to.equal(true);
      });
    });

    describe('register contract', function () {
      describe('admin account', function () {
        it('should register contract', async function () {
          await token.registerContract(anyContractAddress, { from: admin });
        });

        it('shouldn`t register user account address as contract', async function () {
          await expectRevert(
            token.registerContract(userAccountAddress, { from: admin }),
            'revert'
          );
        });

        it('emits a ContractAdded event', async function () {
          const { logs } = await token.registerContract(anyContractAddress, { from: admin });

          expectEvent.inLogs(logs, 'ContractAdded', {
            admin: admin,
            contractAddr: anyContractAddress
          });
        });
      });

      describe('not admin account', function () {
        it('shouldn`t register contract', async function () {
          await expectRevert(
            token.registerContract(anyContractAddress, { from: anotherUserAccount }),
            'Caller has no permission'
          );
        });
      });
    });

    describe('unregister contract', function () {
      describe('admin account', function () {
        beforeEach(async function () {
          await token.registerContract(anyContractAddress, { from: admin });
        });
        
        it('should unregister contract', async function () {
          expect(await token.isRegistered(anyContractAddress)).to.equal(true);
 
          await token.unregisterContract(anyContractAddress, { from: admin });
          expect(await token.isRegistered(anyContractAddress)).to.equal(false);
        });

        it('emits a ContractRemoved event', async function () {
          const { logs } = await token.unregisterContract(anyContractAddress, { from: admin });

          expectEvent.inLogs(logs, 'ContractRemoved', {
            admin: admin,
            contractAddr: anyContractAddress
          });
        });
      });

      describe('not admin account', function () {
        it('shouldn`t unregister contract', async function () {
          await token.registerContract(anyContractAddress, { from: admin });
          expect(await token.isRegistered(anyContractAddress)).to.equal(true);
          await expectRevert(
            token.unregisterContract(anyContractAddress, { from: anotherUserAccount }),
            'Caller has no permission'
          );
          expect(await token.isRegistered(anyContractAddress)).to.equal(true);
        });
      });
    });

    describe('is registered contract', function () {
      it('should check registered contract', async function () {
        await token.registerContract(anyContractAddress, { from: admin });
        expect(await token.isRegistered(anyContractAddress)).to.equal(true);
        token.unregisterContract(anyContractAddress, { from: admin });
        expect(await token.isRegistered(userAccountAddress)).to.equal(false);
      });
    });

    describe('exchange', function () {
      it('should set exchange as contract only admin', async function () {
        await token.setExchangeAddr(exchangeContractAddress, { from: admin });
        expect(await token.isRegistered(exchangeContractAddress)).to.equal(true);
      });

      it('shouldn`t set exchange as user account', async function () {
        const userAccountAddress = anotherUserAccount;

        await expectRevert(
          token.setExchangeAddr(userAccountAddress, { from: admin }),
          'revert'
        );
      });

      it('shouldn`t set exchange not admin', async function () {
        await expectRevert(
          token.setCrowdsaleAddr(exchangeContractAddress, { from: anotherUserAccount }),
          'Caller has no permission'
        );
      });
    });  

    describe('approveAndCall', function () {
      const from = initialHolder;

      let amount = hardcap;
      let to;

      beforeEach(async function () {
        amount = await token.balanceOf(from);
      });

      context('spender contact have a support approveAndCall', function () {
        beforeEach(async function () {
          let approveAndCallFallBackMock = awaitapproveAndCallFallBackMock = await ApproveAndCallFallBackMock.new({ from: deployer });
          to = approveAndCallFallBackMock.address;
        });

        it('should approveAndCall', async function() {
          expect(await token.allowance(from, to)).to.be.bignumber.equal(new BN(0));
          await token.approveAndCall(to, amount, [], { from: from });
          expect(await token.allowance(from, to)).to.be.bignumber.equal(new BN(0));
        });

        it('emits a transfer event', async function () {
          const { logs } = await token.approveAndCall(to, amount, [], { from: from });
          
          expectEvent.inLogs(logs, 'Transfer', {
            from: from,
            to: to,
            value: amount
          });
        });
      });

      context('spender contact haven`t a support approveAndCall', function () {
        it('reverts', async function () {
          const emptyMock = await EmptyMock.new({ from: deployer });
         
          await expectRevert(
            token.approveAndCall(
              emptyMock.address, amount, [], { from: from }),
              'revert'
            );
        });
      });
    });

    describe('withdraw ERC20', function () {
      describe('when the recipient is not the zero address', function () {
        it('should withdraw ERC20 only admin', async function () {
          const amount = new BN('1000000000');

          await token.mint(tokenContractAddress, amount, { from: admin });
          expect(await token.balanceOf(tokenContractAddress)).to.be.bignumber.equal(amount);
          expect(await token.balanceOf(userAccountAddress)).to.be.bignumber.equal('0');

          await token.withdrawERC20(tokenContractAddress, userAccountAddress, { from: admin });
          expect(await token.balanceOf(tokenContractAddress)).to.be.bignumber.equal('0');
          expect(await token.balanceOf(userAccountAddress)).to.be.bignumber.equal(amount);
        });

        it('shouldn`t withdraw ERC20 not admin', async function () {
          await expectRevert(
            token.withdrawERC20(tokenContractAddress, anotherUserAccount, { from: anotherUserAccount }),
             'Caller has no permission'
          );
        });

        it('shouldn`t withdraw ERC20 with zero balance', async function () {
          const emptyBalance = new BN(0);
          await expectRevert(
            token.withdrawERC20(tokenContractAddress, admin, { from: admin }),
            'revert'
          );
        });
      });

      describe('when the recipient is the zero address', function () {
        it('reverts', async function () {
          await expectRevert(
            token.withdrawERC20(tokenContractAddress, ZERO_ADDRESS, { from: admin }),
            'revert'
          );
        });
      });
    });  
  });
});

function getBNwith10Pow(number, pow = 18) {
  return new BN(number).mul(new BN(10).pow(new BN(pow)));
}