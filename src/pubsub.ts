// src/pubsub.ts

type Subscriber = { handleMessage: (message: string, publisher: any, data: any) => void }

interface PubSub {
  publish: (message: string, publisher: any, data: any) => void;
  subscribe: (message: string, subscriber: Subscriber) => void;
  unsubscribe: (message: string, subscriber: Subscriber) => void;
}

const pubsub: PubSub = {
  _subscribers: {},

  publish(message: string, publisher: any, data: any) {
    const subscribers = this._subscribers[message] || [];
    subscribers.forEach((subscriber) => {
      subscriber.handleMessage(message, publisher, data);
    });
  },

  subscribe(message: string, subscriber) {
    if (!(message in this._subscribers)) {
      this._subscribers[message] = [];
    }
    this._subscribers[message].push(subscriber);
  },

  unsubscribe(message: string, subscriber: any) {
    const index = this._subscribers[message].indexOf(subscriber);
    if (index !== -1) {
      this._subscribers[message].splice(index, 1);
    }
  },
};

export default pubsub;
