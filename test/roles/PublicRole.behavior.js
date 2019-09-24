const { expectRevert, constants, expectEvent } = require('openzeppelin-test-helpers');
const { ZERO_ADDRESS } = constants;

const { expect } = require('chai');

function shouldDoActionWithRoleList(listRoles, rolename, manager) {
  const from = manager;

  describe('add', function () {
    const functionName = `addListTo${rolename}`;

    it(`adds role ${rolename} to a new account`, async function () {
      await this.contract[functionName](listRoles, { from });

      for(let i = 0; i < listRoles.length; i++) {
        expect(await this.contract[`is${rolename}`](listRoles[i])).to.equal(true);
      }
    });

    it(`emits a ${rolename}Added event`, async function () {
      const { logs } = await this.contract[functionName](listRoles, { from });

      for(let i = 0; i < listRoles.length; i++) {
        expectEvent.inLogs(logs, `${rolename}Added`, { account: listRoles[i] });
      }
    });
  });
}

function shouldBehaveLikePublicRole(authorized, otherAuthorized, [other], rolename, manager, checkIsConstraction = true) {
  describe('should behave like public role', function () {
      beforeEach('check preconditions', async function () {
        expect(await this.contract[`is${rolename}`](authorized)).to.equal(true);
        expect(await this.contract[`is${rolename}`](otherAuthorized)).to.equal(true);
        expect(await this.contract[`is${rolename}`](other)).to.equal(false);
      });

      if(checkIsConstraction) {
        it('emits events during construction', async function () {
          await expectEvent.inConstruction(this.contract, `${rolename}Added`, {
            account: authorized,
          });
        });
      }
 
      describe('add', function () {
         context(`from manager account`, function () {
          const from = manager;

          it(`adds role ${rolename} to a new account`, async function () {
            await this.contract[`add${rolename}`](other, { from });
            expect(await this.contract[`is${rolename}`](other)).to.equal(true);
          });
  
          it(`emits a ${rolename}Added event`, async function () {
            const { logs } = await this.contract[`add${rolename}`](other, { from });
            expectEvent.inLogs(logs, `${rolename}Added`, { account: other });
          });
        });

        context(`from not manager account`, function () {
          const from = other;

          it('reverts when adding from not manager account', async function () {
            await expectRevert(
              this.contract[`add${rolename}`](other, { from }),
              'revert'
            );
          });
        });
      });
  
      describe('remove', function () {
        const from = manager;
  
        context(`from manager account`, function () {
          it(`removes role ${rolename} from an already assigned account`, async function () {
            await this.contract[`remove${rolename}`](otherAuthorized, { from });
            expect(await this.contract[`is${rolename}`](otherAuthorized)).to.equal(false);
            expect(await this.contract[`is${rolename}`](authorized)).to.equal(true);
          });
  
          it(`emits a ${rolename}Removed event`, async function () {
            const { logs } = await this.contract[`remove${rolename}`](otherAuthorized, { from });
            expectEvent.inLogs(logs, `${rolename}Removed`, { account: otherAuthorized });
          });
  
          it('reverts when removing from an unassigned account', async function () {
            await expectRevert(this.contract[`remove${rolename}`](other, { from: other }),
              'revert'
            );
          });
        });
      });
    });
  }

  module.exports = {
    shouldBehaveLikePublicRole,
    shouldDoActionWithRoleList
  };