// Please paste your contract's solidity code here
// Note that writing a contract here WILL NOT deploy it and allow you to access it from your client
// You should write and develop your contract in Remix and then, before submitting, copy and paste it here
// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.7.0 <0.9.0;

contract Splitwise {
    // debtor => creditor => amount
    mapping(address =>  mapping(address => uint32)) public IOUs;

    function lookup(address debtor, address creditor) external view returns (uint32 ret) {
        return IOUs[debtor][creditor];
    }

    function add_iou(address creditor, uint32 amount, address[] calldata cycle) external {
        address debtor = msg.sender;
        // store the new iou
        IOUs[debtor][creditor] += amount;
        // validate that the cycle exists
        uint256 cycle_size = cycle.length;
        if(cycle_size < 1) return;
        // find the minimum in the cycle
        uint32 min_amount = 0xffffffff;
        bool min_found = false;
        uint32 current_edge;
        for(uint256 i = 0; i < cycle_size; i++) {
            current_edge = IOUs[cycle[i]][cycle[(i+1)%cycle_size]];
            if(current_edge < min_amount) {
                min_amount = current_edge;
                min_found = true;
            }
        }
        if(!min_found) return;
        // subtract the minimum from all items
        for(uint256 i = 0; i < cycle_size; i ++) {
            IOUs[cycle[i]][cycle[(i+1)%cycle_size]] -= min_amount;
        }
    }
}

