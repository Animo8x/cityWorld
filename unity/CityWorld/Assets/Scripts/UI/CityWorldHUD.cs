using UnityEngine;
using TMPro;
using CityWorld.Core;
using CityWorld.Missions;
using CityWorld.Player;
using CityWorld.Police;

namespace CityWorld.UI
{
    public class CityWorldHUD : MonoBehaviour
    {
        [SerializeField] private PlayerController player;
        [SerializeField] private TMP_Text moneyText;
        [SerializeField] private TMP_Text wantedText;
        [SerializeField] private TMP_Text speedText;
        [SerializeField] private TMP_Text missionText;

        private void Update()
        {
            if (CurrencyManager.Instance != null && moneyText != null)
                moneyText.text = $"${CurrencyManager.Instance.Balance:N0}";

            if (WantedSystem.Instance != null && wantedText != null)
                wantedText.text = new string('*', WantedSystem.Instance.WantedStars);

            if (player != null && speedText != null)
            {
                speedText.gameObject.SetActive(player.ActiveVehicle != null);
                if (player.ActiveVehicle != null)
                    speedText.text = $"{Mathf.RoundToInt(player.ActiveVehicle.SpeedKmh)} KM/H";
            }

            if (MissionManager.Instance != null && missionText != null)
            {
                var active = MissionManager.Instance.ActiveMission;
                missionText.text = active != null
                    ? $"{active.missionTitle}: {active.steps[MissionManager.Instance.CurrentStepIndex].description}"
                    : "Explore CityWorld";
            }
        }
    }
}
