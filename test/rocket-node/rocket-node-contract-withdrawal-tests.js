import { printTitle, assertThrows } from '../_lib/utils/general';
import { RocketDepositSettings, RocketMinipoolInterface, RocketMinipoolSettings, RocketNodeSettings } from '../_lib/artifacts';
import { userDeposit } from '../_helpers/rocket-deposit';
import { createGroupContract, createGroupAccessorContract, addGroupAccessor } from '../_helpers/rocket-group';
import { createNodeContract, createNodeMinipools } from '../_helpers/rocket-node';
import { timeoutMinipool, stakeSingleMinipool } from '../_helpers/rocket-minipool';
import { mintRpl } from '../_helpers/rocket-pool-token';
import { scenarioWithdrawMinipoolDeposit } from './rocket-node-contract-scenarios';

export default function() {

    contract('RocketNodeContract - Withdrawals', async (accounts) => {


        // Accounts
        const owner = accounts[0];
        const operator = accounts[1];
        const operatorOther = accounts[2];
        const groupOwner = accounts[3];
        const staker = accounts[4];


        // Setup
        let rocketDepositSettings;
        let rocketMinipoolSettings;
        let rocketNodeSettings;
        let nodeContract;
        let nodeContractOther;
        let groupContract;
        let groupAccessorContract;
        let minipool;
        before(async () => {

            // Get contracts
            rocketDepositSettings = await RocketDepositSettings.deployed();
            rocketMinipoolSettings = await RocketMinipoolSettings.deployed();
            rocketNodeSettings = await RocketNodeSettings.deployed();

            // Create node contracts
            nodeContract = await createNodeContract({timezone: 'Australia/Brisbane', nodeOperator: operator});
            nodeContractOther = await createNodeContract({timezone: 'Australia/Brisbane', nodeOperator: operatorOther});

            // Create group contract
            groupContract = await createGroupContract({name: 'Group 1', stakingFee: web3.utils.toWei('0.05', 'ether'), groupOwner});

            // Create and add group accessor contract
            groupAccessorContract = await createGroupAccessorContract({groupContractAddress: groupContract.address, groupOwner});
            await addGroupAccessor({groupContract, groupAccessorContractAddress: groupAccessorContract.address, groupOwner});

        });


        // Node operator cannot withdraw from a minipool while node withdrawals are disabled
        it(printTitle('node operator', 'cannot withdraw from a minipool while node withdrawals are disabled'), async () => {

            // Create single minipool
            let minipoolAddress = (await createNodeMinipools({nodeContract, stakingDurationID: '3m', minipoolCount: 1, nodeOperator: operator, owner}))[0];
            minipool = await RocketMinipoolInterface.at(minipoolAddress);

            // Check minipool status
            let status = parseInt(await minipool.getStatus.call());
            assert.equal(status, 0, 'Pre-check failed: minipool is not at Initialised status');

            // Disable node withdrawals
            await rocketNodeSettings.setWithdrawalAllowed(false, {from: owner, gas: 500000});

            // Attempt to withdraw node deposit
            await assertThrows(scenarioWithdrawMinipoolDeposit({
                nodeContract,
                minipoolAddress: minipool.address,
                fromAddress: operator,
                gas: 5000000,
            }), 'Withdrew from a minipool while node withdrawals were disabled');

            // Re-enable node withdrawals
            await rocketNodeSettings.setWithdrawalAllowed(true, {from: owner, gas: 500000});

        });


        // Random account cannot withdraw a node deposit from a minipool
        it(printTitle('random account', 'cannot withdraw a node deposit from a minipool'), async () => {

            // Attempt to withdraw node deposit
            await assertThrows(scenarioWithdrawMinipoolDeposit({
                nodeContract,
                minipoolAddress: minipool.address,
                fromAddress: staker,
                gas: 5000000,
            }), 'Random account withdrew a node deposit from a minipool');

        });


        // Node operator can withdraw from an initialised minipool
        it(printTitle('node operator', 'can withdraw from an initialised minipool'), async () => {

            // Withdraw node deposit (destroys minipool)
            await scenarioWithdrawMinipoolDeposit({
                nodeContract,
                minipoolAddress: minipool.address,
                fromAddress: operator,
                gas: 5000000,
            });

        });


        // Node operator can withdraw from an initialised minipool with an RPL balance
        it(printTitle('node operator', 'can withdraw from an initialised minipool with an RPL balance'), async () => {

            // Create single minipool
            let minipoolAddress = (await createNodeMinipools({nodeContract, stakingDurationID: '3m', minipoolCount: 1, nodeOperator: operator, owner}))[0];
            minipool = await RocketMinipoolInterface.at(minipoolAddress);

            // Check minipool status
            let status = parseInt(await minipool.getStatus.call());
            assert.equal(status, 0, 'Pre-check failed: minipool is not at Initialised status');

            // Send RPL to minipool contract
            await mintRpl({toAddress: minipoolAddress, rplAmount: web3.utils.toWei('1', 'ether'), fromAddress: owner});

            // Withdraw node deposit - with minipool RPL balance (destroys minipool)
            await scenarioWithdrawMinipoolDeposit({
                nodeContract,
                minipoolAddress: minipool.address,
                fromAddress: operator,
                gas: 5000000,
            });

        });


        // Node operator can withdraw from an initialised minipool while minipool closure is disabled
        it(printTitle('node operator', 'can withdraw from an initialised minipool while minipool closure is disabled'), async () => {

            // Create single minipool
            let minipoolAddress = (await createNodeMinipools({nodeContract, stakingDurationID: '3m', minipoolCount: 1, nodeOperator: operator, owner}))[0];
            minipool = await RocketMinipoolInterface.at(minipoolAddress);

            // Check minipool status
            let status = parseInt(await minipool.getStatus.call());
            assert.equal(status, 0, 'Pre-check failed: minipool is not at Initialised status');

            // Disable minipool closure
            await rocketMinipoolSettings.setMinipoolClosingEnabled(false, {from: owner, gas: 500000});

            // Withdraw node deposit - with minipool closure disabled (does not destroy minipool)
            await scenarioWithdrawMinipoolDeposit({
                nodeContract,
                minipoolAddress: minipool.address,
                fromAddress: operator,
                gas: 5000000,
            });

            // Re-enable minipool closure
            await rocketMinipoolSettings.setMinipoolClosingEnabled(true, {from: owner, gas: 500000});

            // Destroy minipool
            await minipool.updateStatus({from: owner});

        });


        // Node operator cannot withdraw from a pre-launch minipool
        it(printTitle('node operator', 'cannot withdraw from a pre-launch minipool'), async () => {

            // Create single minipool
            let minipoolAddress = (await createNodeMinipools({nodeContract, stakingDurationID: '3m', minipoolCount: 1, nodeOperator: operator, owner}))[0];
            minipool = await RocketMinipoolInterface.at(minipoolAddress);

            // Get deposit settings
            let chunkSize = parseInt(await rocketDepositSettings.getDepositChunkSize.call());

            // Deposit
            await userDeposit({
                depositorContract: groupAccessorContract,
                durationID: '3m',
                fromAddress: staker,
                value: chunkSize,
            });

            // Check minipool status
            let status = parseInt(await minipool.getStatus.call());
            assert.equal(status, 1, 'Pre-check failed: minipool is not at PreLaunch status');

            // Attempt to withdraw node deposit
            await assertThrows(scenarioWithdrawMinipoolDeposit({
                nodeContract,
                minipoolAddress: minipool.address,
                fromAddress: operator,
                gas: 5000000,
            }), 'Withdrew from a pre-launch minipool');

        });


        // Node operator can withdraw from a timed out minipool
        it(printTitle('node operator', 'can withdraw from a timed out minipool'), async () => {

            // Time out minipool
            await timeoutMinipool({minipoolAddress: minipool.address, owner});

            // Check minipool status
            let status = parseInt(await minipool.getStatus.call());
            assert.equal(status, 6, 'Pre-check failed: minipool is not at TimedOut status');

            // Withdraw node deposit
            await scenarioWithdrawMinipoolDeposit({
                nodeContract,
                minipoolAddress: minipool.address,
                fromAddress: operator,
                gas: 5000000,
            });

        });


        // Node operator cannot withdraw from a staking minipool
        it(printTitle('node operator', 'cannot withdraw from a staking minipool'), async () => {

            // Create single minipool
            let minipoolAddress = (await createNodeMinipools({nodeContract, stakingDurationID: '3m', minipoolCount: 1, nodeOperator: operator, owner}))[0];
            minipool = await RocketMinipoolInterface.at(minipoolAddress);

            // Get deposit settings
            let chunkSize = parseInt(await rocketDepositSettings.getDepositChunkSize.call());

            // Progress minipool to staking
            await stakeSingleMinipool({groupAccessorContract, staker});

            // Check minipool status
            let status = parseInt(await minipool.getStatus.call());
            assert.equal(status, 2, 'Pre-check failed: minipool is not at Staking status');

            // Withdraw node deposit
            await assertThrows(scenarioWithdrawMinipoolDeposit({
                nodeContract,
                minipoolAddress: minipool.address,
                fromAddress: operator,
                gas: 5000000,
            }), 'Withdrew from a staking minipool');

        });


        // Node operator cannot withdraw from a logged out minipool
        it(printTitle('node operator', 'cannot withdraw from a logged out minipool'));


        // Node operator can withdraw from a withdrawn minipool
        it(printTitle('node operator', 'can withdraw from a withdrawn minipool'));


        // Node operator cannot withdraw from another node's minipool
        it(printTitle('node operator', 'cannot withdraw from another node\'s minipool'), async () => {

            // Create single minipool
            let minipoolOtherAddress = (await createNodeMinipools({nodeContract: nodeContractOther, stakingDurationID: '3m', minipoolCount: 1, nodeOperator: operatorOther, owner}))[0];
            let minipoolOther = await RocketMinipoolInterface.at(minipoolOtherAddress);

            // Check minipool status
            let status = parseInt(await minipoolOther.getStatus.call());
            assert.equal(status, 0, 'Pre-check failed: minipool is not at Initialised status');

            // Attempt to withdraw node deposit
            await assertThrows(scenarioWithdrawMinipoolDeposit({
                nodeContract,
                minipoolAddress: minipoolOther.address,
                fromAddress: operator,
                gas: 5000000,
            }), 'Withdrew from another node\'s minipool');

        });


        // Node operator cannot withdraw from an invalid minipool
        it(printTitle('node operator', 'cannot withdraw from an invalid minipool'), async () => {

            // Attempt to withdraw node deposit
            await assertThrows(scenarioWithdrawMinipoolDeposit({
                nodeContract,
                minipoolAddress: accounts[9],
                fromAddress: operator,
                gas: 5000000,
            }), 'Withdrew from an invalid minipool');

        });


    });

}
