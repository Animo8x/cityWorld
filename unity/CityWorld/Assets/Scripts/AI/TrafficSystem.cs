using System.Collections.Generic;
using UnityEngine;
using CityWorld.Core;

namespace CityWorld.AI
{
    public class WaypointNode : MonoBehaviour
    {
        public List<WaypointNode> nextNodes = new List<WaypointNode>();
        public float speedLimit = 14f;
        public TrafficLightController linkedLight;
    }

    public class TrafficLightController : MonoBehaviour
    {
        [SerializeField] private float cycleDuration = 12f;
        [SerializeField] private float phaseOffset;
        public bool IsNorthSouthGreen => ((Time.time + phaseOffset) % cycleDuration) < (cycleDuration * 0.5f);
    }

    public class TrafficVehicleAI : MonoBehaviour
    {
        [SerializeField] private float maxSpeed = 14f;
        [SerializeField] private float detectionDistance = 11f;
        [SerializeField] private LayerMask obstacleMask;

        private WaypointNode targetNode;
        private float currentSpeed;

        public void AssignStartNode(WaypointNode node) => targetNode = node;

        private void Update()
        {
            if (targetNode == null) return;

            bool shouldStop = false;
            if (targetNode.linkedLight != null && !targetNode.linkedLight.IsNorthSouthGreen)
            {
                if (Vector3.Distance(transform.position, targetNode.transform.position) < 12f)
                    shouldStop = true;
            }

            if (Physics.Raycast(transform.position + Vector3.up * 0.8f, transform.forward, detectionDistance, obstacleMask))
            {
                shouldStop = true;
            }

            float desired = shouldStop ? 0f : Mathf.Min(maxSpeed, targetNode.speedLimit);
            currentSpeed = Mathf.Lerp(currentSpeed, desired, Time.deltaTime * (shouldStop ? 6f : 3f));

            Vector3 dir = (targetNode.transform.position - transform.position);
            dir.y = 0f;
            if (dir.magnitude < 2.2f && targetNode.nextNodes.Count > 0)
            {
                targetNode = targetNode.nextNodes[Random.Range(0, targetNode.nextNodes.Count)];
                return;
            }

            if (dir.sqrMagnitude > 0.01f)
            {
                Quaternion targetRot = Quaternion.LookRotation(dir.normalized);
                transform.rotation = Quaternion.Slerp(transform.rotation, targetRot, Time.deltaTime * 5f);
            }
            transform.position += transform.forward * (currentSpeed * Time.deltaTime);
        }
    }

    public class TrafficManager : MonoBehaviour
    {
        [SerializeField] private TrafficVehicleAI[] vehiclePrefabs;
        [SerializeField] private WaypointNode[] spawnNodes;
        [SerializeField] private int poolCount = 24;

        private ObjectPool<TrafficVehicleAI> pool;

        private void Start()
        {
            if (vehiclePrefabs.Length == 0 || spawnNodes.Length == 0) return;
            pool = new ObjectPool<TrafficVehicleAI>(vehiclePrefabs[0], poolCount, transform);
            for (int i = 0; i < poolCount; i++)
            {
                var node = spawnNodes[i % spawnNodes.Length];
                var ai = pool.Get(node.transform.position, node.transform.rotation);
                ai.AssignStartNode(node);
            }
        }
    }
}
