using System.Collections.Generic;
using UnityEngine;
using UnityEngine.SceneManagement;
using CityWorld.Core;

namespace CityWorld.World
{
    public enum DistrictType
    {
        Downtown, Residential, Industrial, Rich, Poor, Beach, Airport, Port, Countryside, Highway
    }

    [System.Serializable]
    public class WorldChunkEntry
    {
        public string chunkSceneName;
        public Vector3 chunkCenter;
        public DistrictType district;
        [HideInInspector] public bool isLoaded;
        [HideInInspector] public bool isLoading;
    }

    public class WorldStreamingManager : MonoBehaviour
    {
        [SerializeField] private Transform player;
        [SerializeField] private float loadRadius = 420f;
        [SerializeField] private float unloadRadius = 560f;
        [SerializeField] private List<WorldChunkEntry> chunks = new List<WorldChunkEntry>();

        private void Update()
        {
            if (player == null) return;
            foreach (var chunk in chunks)
            {
                float dist = Vector3.Distance(player.position, chunk.chunkCenter);
                if (!chunk.isLoaded && !chunk.isLoading && dist < loadRadius)
                {
                    chunk.isLoading = true;
                    var op = SceneManager.LoadSceneAsync(chunk.chunkSceneName, LoadSceneMode.Additive);
                    if (op != null)
                    {
                        op.completed += _ => { chunk.isLoaded = true; chunk.isLoading = false; };
                    }
                }
                else if (chunk.isLoaded && dist > unloadRadius)
                {
                    chunk.isLoaded = false;
                    SceneManager.UnloadSceneAsync(chunk.chunkSceneName);
                }
            }
        }
    }

    public class InteriorPortal : MonoBehaviour, IInteractable
    {
        [SerializeField] private string locationName = "CityWorld Interior";
        [SerializeField] private Transform destinationPoint;

        public string InteractionPrompt => $"[E] Enter {locationName}";

        public void Interact(GameObject interactor)
        {
            if (destinationPoint == null) return;
            var cc = interactor.GetComponent<CharacterController>();
            if (cc != null) cc.enabled = false;
            interactor.transform.SetPositionAndRotation(destinationPoint.position, destinationPoint.rotation);
            if (cc != null) cc.enabled = true;
        }
    }
}
