// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title NEXORUM Simple ERC-20 Token
/// @notice Minimal, standard-compliant ERC-20 deployed directly from a
/// connected wallet via the NEXORUM OS Launchpad. The full supply is
/// minted once to `initialHolder` at construction time — there is no
/// owner, no mint/burn function, and no admin key after deployment.
/// Kept intentionally small (no external calls, no delegatecall, no
/// upgradeability) so it's easy to read end-to-end before trusting it
/// with real funds.
contract NexorumToken {
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _initialSupply,
        address _initialHolder
    ) {
        require(_initialHolder != address(0), "NexorumToken: zero holder");
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        totalSupply = _initialSupply;
        balanceOf[_initialHolder] = _initialSupply;
        emit Transfer(address(0), _initialHolder, _initialSupply);
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= value, "NexorumToken: allowance exceeded");
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - value;
        }
        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(to != address(0), "NexorumToken: transfer to zero address");
        uint256 fromBalance = balanceOf[from];
        require(fromBalance >= value, "NexorumToken: insufficient balance");
        unchecked {
            balanceOf[from] = fromBalance - value;
        }
        balanceOf[to] += value;
        emit Transfer(from, to, value);
    }
}
