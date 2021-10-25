// Please paste your contract's solidity code here
// Note that writing a contract here WILL NOT deploy it and allow you to access it from your client
// You should write and develop your contract in Remix and then, before submitting, copy and paste it here
// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.7.0 <0.9.0;

contract Splitwise {
    // debtor => creditor => amount
    mapping(address =>  mapping(address => uint32)) public IOUs;
    mapping(address => uint32) public Balances;

    function lookup(address debtor, address creditor) external view returns (uint32 ret) {
        // todo - check that debtor exists, creditor exists
        return IOUs[debtor][creditor];
    }

    function lookup_user_balance(address user) external view returns (uint32 ret) {
        // todo - check that the account exists
        return Balances[user];
    }

    function add_iou(address creditor, uint32 amount, address[] calldata cycle) external {
        // todo - require the iou to be positive
        address debtor = msg.sender;
        // store the new iou
        // todo - verfy that it initializs to 0
        IOUs[debtor][creditor] += amount;
        Balances[debtor] += amount;
        // validate that the cycle exists
        uint256 cycle_size = cycle.length;
        // todo - make sure this syntax is okay
        if(cycle_size < 1) return;
        // find the minimum in the cycle
        uint32 min_amount = 0;
        uint32 current_edge;
        for(uint256 i = 0; i < cycle_size - 1; i++) {
            // todo - verify that the edge exists in the DEBTS mapping
            current_edge = IOUs[cycle[i]][cycle[i+1]];
            if(current_edge < min_amount) min_amount = current_edge;
        }
        current_edge = IOUs[cycle[cycle_size - 1]][cycle[0]];
        if(current_edge < min_amount) min_amount = current_edge;
        // subtract the minimum from all items
        for(uint256 i = 0; i < cycle_size - 1; i ++) {
            IOUs[cycle[i]][cycle[i+1]] -= min_amount;
            Balances[cycle[i]] -= min_amount;
        }
        IOUs[cycle[cycle_size - 1]][cycle[0]] -= min_amount;
        Balances[cycle[cycle_size - 1]] -= min_amount;
    }
}

