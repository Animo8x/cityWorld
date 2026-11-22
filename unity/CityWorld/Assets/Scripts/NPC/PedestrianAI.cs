using UnityEngine;
using UnityEngine.AI;

namespace CityWorld.NPC
{
    [RequireComponent(typeof(NavMeshAgent))]
    public class PedestrianAI : MonoBehaviour
    {
        [SerializeField] private float walkSpeed = 1.8f;
        [SerializeField] private float fleeSpeed = 5.2f;
        [SerializeField] private float roamRadius = 40f;

        private NavMeshAgent agent;
        private float panicTimer;
        private float wanderTimer;

        private void Awake()
        {
            agent = GetComponent<NavMeshAgent>();
            agent.speed = walkSpeed;
        }

        private void Update()
        {
            if (panicTimer > 0f)
            {
                panicTimer -= Time.deltaTime;
                if (panicTimer <= 0f) agent.speed = walkSpeed;
            }

            wanderTimer -= Time.deltaTime;
            if (wanderTimer <= 0f || (!agent.pathPending && agent.remainingDistance < 1.2f))
            {
                PickNewDestination();
                wanderTimer = Random.Range(4f, 10f);
            }
        }

        public void TriggerFlee(Vector3 dangerOrigin)
        {
            panicTimer = 6f;
            agent.speed = fleeSpeed;
            Vector3 away = (transform.position - dangerOrigin).normalized * 25f;
            if (NavMesh.SamplePosition(transform.position + away, out NavMeshHit hit, 15f, NavMesh.AllAreas))
            {
                agent.SetDestination(hit.position);
            }
        }

        private void PickNewDestination()
        {
            Vector3 randomOffset = Random.insideUnitSphere * roamRadius;
            randomOffset.y = 0f;
            if (NavMesh.SamplePosition(transform.position + randomOffset, out NavMeshHit hit, 12f, NavMesh.AllAreas))
            {
                agent.SetDestination(hit.position);
            }
        }
    }
}
