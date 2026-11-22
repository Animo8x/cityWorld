using UnityEngine;
using UnityEngine.Audio;

namespace CityWorld.Audio
{
    public class AudioManager : MonoBehaviour
    {
        public static AudioManager Instance { get; private set; }
        [SerializeField] private AudioMixer masterMixer;

        private void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
        }

        public void SetChannelVolume(string exposedParam, float linear01)
        {
            if (masterMixer == null) return;
            float db = linear01 <= 0.001f ? -80f : Mathf.Log10(linear01) * 20f;
            masterMixer.SetFloat(exposedParam, db);
        }
    }
}
