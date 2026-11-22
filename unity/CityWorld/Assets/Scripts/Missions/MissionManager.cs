using System;
using System.Collections.Generic;
using UnityEngine;
using CityWorld.Core;
using CityWorld.Police;

namespace CityWorld.Missions
{
    public enum ObjectiveType { GoToLocation, TimedCheckpoint, EvadePolice, CollectAll }

    [Serializable]
    public class MissionObjectiveData
    {
        public string description;
        public ObjectiveType type;
        public Vector3 targetPosition;
        public float triggerRadius = 8f;
        public float timeLimit = 0f;
        public int wantedStarsOnStart = 0;
    }

    [CreateAssetMenu(fileName = "MissionData", menuName = "CityWorld/Mission Data")]
    public class MissionDataSO : ScriptableObject
    {
        public string missionId;
        public string missionTitle;
        public int rewardMoney = 500;
        public List<MissionObjectiveData> steps = new List<MissionObjectiveData>();
    }

    public class MissionManager : MonoBehaviour
    {
        public static MissionManager Instance { get; private set; }

        [SerializeField] private Transform player;
        [SerializeField] private MissionDataSO[] missionCatalog;

        public MissionDataSO ActiveMission { get; private set; }
        public int CurrentStepIndex { get; private set; }
        public float TimeRemaining { get; private set; }

        public event Action<MissionDataSO, int> OnMissionUpdated;
        public event Action<MissionDataSO, bool> OnMissionEnded;

        private void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
        }

        public void StartMission(MissionDataSO mission)
        {
            if (ActiveMission != null || mission == null || mission.steps.Count == 0) return;
            ActiveMission = mission;
            CurrentStepIndex = 0;
            SetupStep();
        }

        private void SetupStep()
        {
            var step = ActiveMission.steps[CurrentStepIndex];
            TimeRemaining = step.timeLimit;
            if (step.wantedStarsOnStart > 0)
                WantedSystem.Instance?.ReportCrime(step.wantedStarsOnStart * 95f);
            OnMissionUpdated?.Invoke(ActiveMission, CurrentStepIndex);
        }

        private void Update()
        {
            if (ActiveMission == null || player == null) return;
            var step = ActiveMission.steps[CurrentStepIndex];

            if (step.timeLimit > 0f)
            {
                TimeRemaining -= Time.deltaTime;
                if (TimeRemaining <= 0f)
                {
                    var failed = ActiveMission;
                    ActiveMission = null;
                    OnMissionEnded?.Invoke(failed, false);
                    return;
                }
            }

            bool done = false;
            if (step.type == ObjectiveType.GoToLocation || step.type == ObjectiveType.TimedCheckpoint)
            {
                if (Vector3.Distance(player.position, step.targetPosition) <= step.triggerRadius)
                    done = true;
            }
            else if (step.type == ObjectiveType.EvadePolice)
            {
                if (WantedSystem.Instance == null || WantedSystem.Instance.WantedStars == 0)
                    done = true;
            }

            if (done)
            {
                CurrentStepIndex++;
                if (CurrentStepIndex >= ActiveMission.steps.Count)
                {
                    var completed = ActiveMission;
                    ActiveMission = null;
                    CurrencyManager.Instance?.AddMoney(completed.rewardMoney);
                    OnMissionEnded?.Invoke(completed, true);
                }
                else
                {
                    SetupStep();
                }
            }
        }
    }
}
