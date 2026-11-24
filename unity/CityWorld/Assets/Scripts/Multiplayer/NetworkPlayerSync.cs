using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace CityWorld.Multiplayer
{
    public struct PlayerNetworkSnapshot
    {
        public float timestamp;
        public Vector3 position;
        public float headingDeg;
        public Vector3 velocity;
        public string animState;
        public string skinId;
        public string weaponId;
        public string vehicleId;
        public int seatIndex;
    }

    /// <summary>
    /// Interpolates remote human players (~95ms buffer) and renders the floating Nameplate ONLY on real Multiplayer players (never NPCs).
    /// </summary>
    public class NetworkPlayerSync : MonoBehaviour
    {
        [Header("Interpolation")]
        [SerializeField] private float interpolationBackTime = 0.095f;
        [SerializeField] private float teleportSnapDistance = 42f;

        [Header("Nameplate (Remote Players Only)")]
        [SerializeField] private Text nameplateText;
        [SerializeField] private Transform nameplateRoot;

        public string PlayerId { get; private set; }
        public string DisplayName { get; private set; } = "Player 1";

        private readonly List<PlayerNetworkSnapshot> snapshotBuffer = new List<PlayerNetworkSnapshot>(24);
        private Camera mainCam;

        public void Initialize(string playerId, string displayName)
        {
            PlayerId = playerId;
            SetDisplayName(displayName);
            mainCam = Camera.main;
        }

        public void SetDisplayName(string newName)
        {
            DisplayName = string.IsNullOrWhiteSpace(newName) ? "Player" : newName;
            if (nameplateText != null)
            {
                nameplateText.text = DisplayName;
            }
        }

        public void PushSnapshot(PlayerNetworkSnapshot snapshot)
        {
            snapshotBuffer.Add(snapshot);
            if (snapshotBuffer.Count > 24)
            {
                snapshotBuffer.RemoveAt(0);
            }
        }

        private void Update()
        {
            if (snapshotBuffer.Count > 0)
            {
                float renderTime = Time.unscaledTime - interpolationBackTime;
                SampleSnapshot(renderTime);
            }

            if (nameplateRoot != null && mainCam != null)
            {
                nameplateRoot.LookAt(nameplateRoot.position + mainCam.transform.rotation * Vector3.forward,
                    mainCam.transform.rotation * Vector3.up);
            }
        }

        private void SampleSnapshot(float renderTime)
        {
            if (snapshotBuffer.Count == 1)
            {
                ApplyPose(snapshotBuffer[0].position, snapshotBuffer[0].headingDeg);
                return;
            }

            PlayerNetworkSnapshot newer = snapshotBuffer[snapshotBuffer.Count - 1];
            PlayerNetworkSnapshot older = snapshotBuffer[snapshotBuffer.Count - 2];

            for (int i = snapshotBuffer.Count - 1; i >= 1; i--)
            {
                if (snapshotBuffer[i - 1].timestamp <= renderTime && snapshotBuffer[i].timestamp >= renderTime)
                {
                    older = snapshotBuffer[i - 1];
                    newer = snapshotBuffer[i];
                    break;
                }
            }

            float span = Mathf.Max(0.0001f, newer.timestamp - older.timestamp);
            float t = Mathf.Clamp01((renderTime - older.timestamp) / span);

            if (Vector3.Distance(older.position, newer.position) > teleportSnapDistance)
            {
                ApplyPose(newer.position, newer.headingDeg);
                return;
            }

            Vector3 interpPos = Vector3.Lerp(older.position, newer.position, t);
            float interpHeading = Mathf.LerpAngle(older.headingDeg, newer.headingDeg, t);
            ApplyPose(interpPos, interpHeading);
        }

        private void ApplyPose(Vector3 pos, float headingDeg)
        {
            transform.position = pos;
            transform.rotation = Quaternion.Euler(0f, headingDeg, 0f);
        }
    }
}
