// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Escrow {
    struct EscrowItem {
        address client;
        address freelancer;
        uint256 amount;
        bool isCompleted;
        bool isDisputed;
    }

    mapping(uint256 => EscrowItem) public escrows;
    uint256 public escrowCount;

    event EscrowCreated(uint256 indexed escrowId, address indexed client, address indexed freelancer, uint256 amount);
    event WorkSubmitted(uint256 indexed escrowId);
    event FundsReleased(uint256 indexed escrowId, uint256 amount);
    event DisputeRaised(uint256 indexed escrowId);

    function createEscrow(address _freelancer) external payable {
        require(msg.value > 0, "Deposit amount must be greater than 0");
        escrowCount++;
        escrows[escrowCount] = EscrowItem({
            client: msg.sender,
            freelancer: _freelancer,
            amount: msg.value,
            isCompleted: false,
            isDisputed: false
        });
        emit EscrowCreated(escrowCount, msg.sender, _freelancer, msg.value);
    }

    function submitWork(uint256 _escrowId) external {
        EscrowItem storage item = escrows[_escrowId];
        require(msg.sender == item.freelancer, "Only freelancer can submit work");
        emit WorkSubmitted(_escrowId);
    }

    function releaseFunds(uint256 _escrowId) external {
        EscrowItem storage item = escrows[_escrowId];
        require(msg.sender == item.client, "Only client can release funds");
        require(!item.isCompleted, "Escrow already completed");
        require(!item.isDisputed, "Escrow is under dispute");

        item.isCompleted = true;
        payable(item.freelancer).transfer(item.amount);
        emit FundsReleased(_escrowId, item.amount);
    }

    function raiseDispute(uint256 _escrowId) external {
        EscrowItem storage item = escrows[_escrowId];
        require(msg.sender == item.client || msg.sender == item.freelancer, "Not authorized");
        item.isDisputed = true;
        emit DisputeRaised(_escrowId);
    }
}