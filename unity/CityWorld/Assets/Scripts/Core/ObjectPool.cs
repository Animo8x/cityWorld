using System.Collections.Generic;
using UnityEngine;

namespace CityWorld.Core
{
    public class ObjectPool<T> where T : Component
    {
        private readonly T prefab;
        private readonly Transform parent;
        private readonly Queue<T> pool = new Queue<T>();

        public ObjectPool(T prefab, int initialCount, Transform parent = null)
        {
            this.prefab = prefab;
            this.parent = parent;
            for (int i = 0; i < initialCount; i++)
            {
                var inst = Object.Instantiate(prefab, parent);
                inst.gameObject.SetActive(false);
                pool.Enqueue(inst);
            }
        }

        public T Get(Vector3 pos, Quaternion rot)
        {
            T item = pool.Count > 0 ? pool.Dequeue() : Object.Instantiate(prefab, parent);
            item.transform.SetPositionAndRotation(pos, rot);
            item.gameObject.SetActive(true);
            return item;
        }

        public void Return(T item)
        {
            item.gameObject.SetActive(false);
            pool.Enqueue(item);
        }
    }
}
