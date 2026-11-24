using System.Collections.Generic;
using UnityEngine;

namespace CityWorld.Multiplayer
{
    public struct VehicleNetworkSnapshot
    {
        public float timestamp;
        public Vector3 position;
        public float headingDeg;
        public float pitchDeg;
        public float rollDeg;
        public float speedMps;
        public float steerAngle;
        public bool wingModeActive;
        public bool headlightsOn;
    }

    /// <summary>
    /// Synchronizes remote shared vehicles controlled by their authoritative Driver (Seat 0).
    /// Passengers do not send vehicle physics updates; only the Driver broadcasts authoritative state.
    /// </summary>
    public class NetworkVehicleSync : MonoBehaviour
    {
        [SerializeField] private float interpolationBackTime = 0.095f;
        [SerializeField] private Transform[] wheelMeshes;
        [SerializeField] private Light[] headlights;
        [SerializeField] private GameObject[] wingVisuals;

        public string VehicleId { get; private set; }
        public string DriverPlayerId { get; private set; }
        public float CurrentSpeedMps { get; private set; }

        private readonly List<VehicleNetworkSnapshot> buffer = new List<VehicleNetworkSnapshot>(24);
        private float wheelSpinAngle;

        public void Initialize(string vehicleId, string driverPlayerId)
        {
            VehicleId = vehicleId;
            DriverPlayerId = driverPlayerId;
        }

        public void SetDriver(string driverPlayerId)
        {
            DriverPlayerId = driverPlayerId;
        }

        public void PushSnapshot(VehicleNetworkSnapshot snap)
        {
            buffer.Add(snap);
            if (buffer.Count > 24) buffer.RemoveAt(0);
        }

        private void Update()
        {
            if (buffer.Count == 0) return;

            float renderTime = Time.unscaledTime - interpolationBackTime;
            VehicleNetworkSnapshot newer = buffer[buffer.Count - 1];
            VehicleNetworkSnapshot older = buffer.Count > 1 ? buffer[buffer.Count - 2] : newer;

            for (int i = buffer.Count - 1; i >= 1; i--)
            {
                if (buffer[i - 1].timestamp <= renderTime && buffer[i].timestamp >= renderTime)
                {
                    older = buffer[i - 1];
                    newer = buffer[i];
                    break;
                }
            }

            float span = Mathf.Max(0.0001f, newer.timestamp - older.timestamp);
            float t = buffer.Count == 1 ? 1f : Mathf.Clamp01((renderTime - older.timestamp) / span);

            transform.position = Vector3.Lerp(older.position, newer.position, t);
            float yaw = Mathf.LerpAngle(older.headingDeg, newer.headingDeg, t);
            float pitch = Mathf.LerpAngle(older.pitchDeg, newer.pitchDeg, t);
            float roll = Mathf.LerpAngle(older.rollDeg, newer.rollDeg, t);
            transform.rotation = Quaternion.Euler(pitch, yaw, roll);

            CurrentSpeedMps = Mathf.Lerp(older.speedMps, newer.speedMps, t);
            wheelSpinAngle += CurrentSpeedMps * Time.deltaTime * 110f;

            if (wheelMeshes != null)
            {
                for (int i = 0; i < wheelMeshes.Length; i++)
                {
                    if (wheelMeshes[i] == null) continue;
                    wheelMeshes[i].localRotation = Quaternion.Euler(wheelSpinAngle, 0f, 0f);
                }
            }

            if (headlights != null)
            {
                foreach (var lightComp in headlights)
                {
                    if (lightComp != null) lightComp.enabled = newer.headlightsOn;
                }
            }

            if (wingVisuals != null)
            {
                foreach (var wing in wingVisuals)
                {
                    if (wing != null) wing.SetActive(newer.wingModeActive);
                }
            }
        }
    }
}
