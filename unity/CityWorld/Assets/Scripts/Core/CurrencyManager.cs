using System;
using UnityEngine;

namespace CityWorld.Core
{
    public class CurrencyManager : MonoBehaviour
    {
        public static CurrencyManager Instance { get; private set; }

        [SerializeField] private int startingBalance = 1200;
        public int Balance { get; private set; }

        public event Action<int> OnBalanceChanged;

        private void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
            Balance = startingBalance;
        }

        public void AddMoney(int amount)
        {
            if (amount <= 0) return;
            Balance += amount;
            OnBalanceChanged?.Invoke(Balance);
        }

        public bool TrySpend(int amount)
        {
            if (amount <= 0 || Balance < amount) return false;
            Balance -= amount;
            OnBalanceChanged?.Invoke(Balance);
            return true;
        }
    }
}
