using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.AI;

namespace CityWorld.Police
{
    public class WantedSystem : MonoBehaviour
    {
        public static WantedSystem Instance { get; private set; }

        [SerializeField] private PoliceAI policePrefab;
        [SerializeField] private Transform player;
        [SerializeField] private Camera mainCamera;
        [SerializeField] private float evadeTimeSeconds = 18f;

        public int WantedStars { get; private set; }
        public float EvadeProgress { get; private set; }

        public event Action<int> OnWantedChanged;

        private readonly List<PoliceAI> activeUnits = new List<PoliceAI>();
        private float heat;
        private float searchTimer;

        private void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
        }

        public void ReportCrime(float heatGain)
        {
            heat = Mathf.Min(500f, heat + heatGain);
            int next = Mathf.Min(5, Mathf.CeilToInt(heat / 95f));
            if (next != WantedStars)
            {
                WantedStars = next;
                OnWantedChanged?.Invoke(WantedStars);
            }
            searchTimer = 0f;
        }

        public void ClearWanted()
        {
            heat = 0f;
            WantedStars = 0;
            searchTimer = 0f;
            foreach (var unit in activeUnits) unit.gameObject.SetActive(false);
            OnWantedChanged?.Invoke(0);
        }

        private void Update()
        {
            if (WantedStars <= 0 || player == null) return;

            int needed = Mathf.Clamp(WantedStars, 1, 5);
            while (activeUnits.Count < needed && policePrefab != null)
            {
                var unit = Instantiate(policePrefab);
                activeUnits.Add(unit);
            }

            bool anyHasSight = false;
            for (int i = 0; i < activeUnits.Count; i++)
            {
                bool enable = i < needed;
                var u = activeUnits[i];
                if (!enable) { u.gameObject.SetActive(false); continue; }
                if (!u.gameObject.activeSelf) SpawnOutOfSight(u);

                u.SetTarget(player.position);
                if (Vector3.Distance(u.transform.position, player.position) < 85f) anyHasSight = true;
            }

            if (anyHasSight)
            {
                searchTimer = Mathf.Max(0f, searchTimer - Time.deltaTime * 2f);
            }
            else
            {
                searchTimer += Time.deltaTime;
                if (searchTimer >= evadeTimeSeconds) ClearWanted();
            }
            EvadeProgress = Mathf.Clamp01(searchTimer / evadeTimeSeconds);
        }

        private void SpawnOutOfSight(PoliceAI unit)
        {
            Vector3 back = mainCamera != null ? -mainCamera.transform.forward : -player.forward;
            back.y = 0f;
            Vector3 candidate = player.position + back.normalized * 110f + player.right * UnityEngine.Random.Range(-35f, 35f);
            if (NavMesh.SamplePosition(candidate, out NavMeshHit hit, 35f, NavMesh.AllAreas))
            {
                unit.transform.position = hit.position;
                unit.gameObject.SetActive(true);
            }
        }
    }

    [RequireComponent(typeof(NavMeshAgent))]
    public class PoliceAI : MonoBehaviour
    {
        private NavMeshAgent agent;
        private void Awake() => agent = GetComponent<NavMeshAgent>();
        public void SetTarget(Vector3 pos) { if (agent.isOnNavMesh) agent.SetDestination(pos); }
    }
}
