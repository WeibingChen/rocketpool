import { printTitle, assertThrows } from '../_lib/utils/general';
import { createNodeContract } from '../_helpers/rocket-node';
import { scenarioSetNodeTrusted } from './rocket-admin-scenarios';

export default function() {

    contract('RocketAdmin', async (accounts) => {


        // Accounts
        const owner = accounts[0];
        const nodeOperator = accounts[1];


        // Setup
        before(async () => {

            // Create node contract
            let nodeContract = await createNodeContract({timezone: 'Australia/Brisbane', nodeOperator});

        });


        // Owner can set a node to trusted
        it(printTitle('owner', 'can set a node to trusted'), async () => {
            await scenarioSetNodeTrusted({
                nodeAddress: nodeOperator,
                trusted: true,
                fromAddress: owner,
                gas: 5000000,
            });
        });


        // Owner cannot set a trusted node to its current status
        it(printTitle('owner', 'cannot set a trusted node to its current status'), async () => {
            await assertThrows(scenarioSetNodeTrusted({
                nodeAddress: nodeOperator,
                trusted: true,
                fromAddress: owner,
                gas: 5000000,
            }), 'Set a trusted node to its current status');
        });


        // Owner can set a node to untrusted
        it(printTitle('owner', 'can set a node to untrusted'), async () => {
            await scenarioSetNodeTrusted({
                nodeAddress: nodeOperator,
                trusted: false,
                fromAddress: owner,
                gas: 5000000,
            });
        });


        // Owner cannot set an untrusted node to its current status
        it(printTitle('owner', 'cannot set an untrusted node to its current status'), async () => {
            await assertThrows(scenarioSetNodeTrusted({
                nodeAddress: nodeOperator,
                trusted: false,
                fromAddress: owner,
                gas: 5000000,
            }), 'Set an untrusted node to its current status');
        });


        // Owner cannot set the trusted status of a nonexistant node
        it(printTitle('owner', 'cannot set the trusted status of a nonexistant node'), async () => {
            await assertThrows(scenarioSetNodeTrusted({
                nodeAddress: accounts[9],
                trusted: true,
                fromAddress: owner,
                gas: 5000000,
            }), 'Set the trusted status of a nonexistant node');
        });


        // Random account cannot set a node's trusted status
        it(printTitle('random account', 'cannot set a node\'s trusted status'), async () => {
            await assertThrows(scenarioSetNodeTrusted({
                nodeAddress: nodeOperator,
                trusted: true,
                fromAddress: accounts[9],
                gas: 5000000,
            }), 'Random account set a node\'s trusted status');
        });


    });

}
