using UnityEngine;

namespace CityWorld.Player
{
    public class ThirdPersonCamera : MonoBehaviour
    {
        [SerializeField] private PlayerController player;
        [SerializeField] private float distanceOnFoot = 5.5f;
        [SerializeField] private float distanceInVehicle = 8.5f;
        [SerializeField] private float sensitivity = 2.6f;
        [SerializeField] private float smoothSpeed = 12f;
        [SerializeField] private LayerMask collisionMask;

        private float yaw;
        private float pitch = 18f;
        private float currentDistance;
        private float shakeIntensity;

        public void AddShake(float amount) => shakeIntensity = Mathf.Clamp01(shakeIntensity + amount);

        private void LateUpdate()
        {
            if (player == null) return;

            yaw += Input.GetAxis("Mouse X") * sensitivity;
            pitch = Mathf.Clamp(pitch - Input.GetAxis("Mouse Y") * sensitivity, -12f, 68f);

            bool driving = player.ActiveVehicle != null;
            Transform target = driving ? player.ActiveVehicle.transform : player.transform;
            float desiredDist = driving ? distanceInVehicle : distanceOnFoot;
            currentDistance = Mathf.Lerp(currentDistance, desiredDist, Time.deltaTime * 6f);

            Vector3 pivot = target.position + Vector3.up * (driving ? 1.5f : 1.6f);
            Quaternion rot = Quaternion.Euler(pitch, yaw, 0f);
            Vector3 desiredPos = pivot - (rot * Vector3.forward) * currentDistance;

            if (Physics.Linecast(pivot, desiredPos, out RaycastHit hit, collisionMask))
            {
                desiredPos = hit.point + hit.normal * 0.3f;
            }

            if (shakeIntensity > 0.01f)
            {
                desiredPos += Random.insideUnitSphere * shakeIntensity * 0.45f;
                shakeIntensity = Mathf.Lerp(shakeIntensity, 0f, Time.deltaTime * 10f);
            }

            transform.position = Vector3.Lerp(transform.position, desiredPos, Time.deltaTime * smoothSpeed);
            transform.LookAt(pivot);
        }
    }
}
