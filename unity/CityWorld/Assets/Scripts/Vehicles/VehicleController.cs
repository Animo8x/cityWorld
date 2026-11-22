using UnityEngine;

namespace CityWorld.Vehicles
{
    [RequireComponent(typeof(Rigidbody))]
    public class VehicleController : MonoBehaviour
    {
        [SerializeField] private VehicleDataSO data;
        [SerializeField] private WheelCollider[] frontWheels;
        [SerializeField] private WheelCollider[] rearWheels;
        [SerializeField] private Transform[] wheelVisuals;
        [SerializeField] private Transform exitPoint;
        [SerializeField] private Light[] headlights;
        [SerializeField] private Renderer[] brakeLights;
        [SerializeField] private AudioSource engineAudio;

        private Rigidbody rb;
        private bool isPlayerControlled;
        private bool lightsOn;

        public float SpeedKmh => rb.linearVelocity.magnitude * 3.6f;

        private void Awake()
        {
            rb = GetComponent<Rigidbody>();
            if (data != null) rb.mass = data.mass;
            rb.centerOfMass = new Vector3(0f, -0.45f, 0f);
        }

        public void SetPlayerDriver(bool active) => isPlayerControlled = active;

        public Vector3 GetExitPoint() => exitPoint != null ? exitPoint.position : transform.position + transform.right * 2.2f;

        private void Update()
        {
            if (isPlayerControlled && Input.GetKeyDown(KeyCode.L))
            {
                lightsOn = !lightsOn;
                foreach (var l in headlights) if (l != null) l.enabled = lightsOn;
            }
            if (engineAudio != null)
            {
                float ratio = Mathf.Clamp01(SpeedKmh / (data != null ? data.maxSpeedKmh : 140f));
                engineAudio.pitch = 0.8f + ratio * 1.6f;
            }
            UpdateWheelMeshes();
        }

        private void FixedUpdate()
        {
            if (!isPlayerControlled || data == null) return;

            float throttle = Input.GetAxis("Vertical");
            float steer = Input.GetAxis("Horizontal");
            bool handbrake = Input.GetKey(KeyCode.Space);

            float steerAngle = steer * data.maxSteerAngle;
            foreach (var fw in frontWheels) fw.steerAngle = steerAngle;

            float torque = SpeedKmh < data.maxSpeedKmh ? throttle * data.motorTorque : 0f;
            foreach (var rw in rearWheels)
            {
                rw.motorTorque = torque;
                rw.brakeTorque = handbrake ? data.brakeTorque * 1.5f : 0f;
            }

            if (throttle < 0f && Vector3.Dot(rb.linearVelocity, transform.forward) > 1f)
            {
                foreach (var fw in frontWheels) fw.brakeTorque = data.brakeTorque;
            }
            else
            {
                foreach (var fw in frontWheels) fw.brakeTorque = 0f;
            }

            rb.AddForce(-transform.up * data.downforce * rb.linearVelocity.magnitude);
        }

        private void UpdateWheelMeshes()
        {
            int idx = 0;
            foreach (var wc in frontWheels) SyncWheel(wc, idx++);
            foreach (var wc in rearWheels) SyncWheel(wc, idx++);
        }

        private void SyncWheel(WheelCollider wc, int idx)
        {
            if (wheelVisuals == null || idx >= wheelVisuals.Length || wheelVisuals[idx] == null) return;
            wc.GetWorldPose(out Vector3 pos, out Quaternion rot);
            wheelVisuals[idx].SetPositionAndRotation(pos, rot);
        }
    }
}
