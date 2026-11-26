"""Grad-CAM heatmap for the ResNet50 crack classifier (spec module 12).

Our classifier is built like:
    input -> augmentation -> ResNet50 base (nested model) -> Dropout -> Dense
The ResNet50 base ends with pooling, so its output is only a flat vector.
Grad-CAM needs the last feature map INSIDE the base (7 x 7 x 2048),
so we make a small helper model that returns both: feature map and base output.

Every layer is called with training=False. Without it the random augmentation
layers (RandomFlip, ...) would flip the image and the heatmap would be mirrored.
"""
import cv2
import numpy as np
import tensorflow as tf
from tensorflow import keras


def split_model(model):
    """Return (layers_before_base, base_model, layers_after_base).

    The model can contain more than one nested model (for example the
    augmentation Sequential). The ResNet50 base is the biggest one."""
    layers = [l for l in model.layers if not isinstance(l, keras.layers.InputLayer)]
    nested = [i for i, l in enumerate(layers) if isinstance(l, keras.Model)]
    if not nested:
        raise ValueError(
            "Grad-CAM ke liye model ke andar nested ResNet50 base nahi mila. "
            "model.summary() ka output bhejo."
        )
    i = max(nested, key=lambda k: len(layers[k].layers))     # biggest nested model
    return layers[:i], layers[i], layers[i + 1:]


def last_feature_map_layer(base):
    """Last layer inside the base whose output is a feature map (4 dimensions)."""
    for layer in reversed(base.layers):
        if len(layer.output.shape) == 4:
            return layer
    raise ValueError("Base model ke andar koi feature map layer nahi mila.")


def compute_heatmap(model, x):
    """x: already preprocessed batch, shape (1, H, W, 3).
    Returns a small heatmap (7 x 7 for ResNet50) with values between 0 and 1."""
    before, base, after = split_model(model)
    if not after:
        raise ValueError("Base ke baad koi layer nahi mili (Dropout/Dense expected).")
    conv_layer = last_feature_map_layer(base)
    helper = keras.Model(base.inputs, [conv_layer.output, base.output])

    x = tf.convert_to_tensor(x)
    for layer in before:
        x = layer(x, training=False)

    with tf.GradientTape() as tape:
        features, base_out = helper(x, training=False)     # features: (1, 7, 7, 2048)
        tape.watch(features)
        y = base_out
        for layer in after[:-1]:
            y = layer(y, training=False)
        last = after[-1]
        if isinstance(last, keras.layers.Dense):
            # use the value BEFORE sigmoid, so the gradient does not vanish
            # when the model is very sure (probability close to 0 or 1)
            y = tf.matmul(y, last.kernel) + last.bias
        else:
            y = last(y, training=False)
        score = y[:, 0]                                    # crack score

    grads = tape.gradient(score, features)
    weights = tf.reduce_mean(grads, axis=(1, 2))                    # (1, 2048)
    cam = tf.reduce_sum(features * weights[:, None, None, :], axis=-1)[0]
    cam = tf.nn.relu(cam)
    cam = cam / (tf.reduce_max(cam) + 1e-8)
    return cam.numpy()


def save_overlay(image_rgb, heatmap, out_path):
    """Draw the heatmap on top of the original image and save it."""
    h, w = image_rgb.shape[:2]
    heat = cv2.resize(heatmap, (w, h), interpolation=cv2.INTER_CUBIC)
    heat = np.clip(heat, 0, 1)
    heat_color = cv2.applyColorMap((heat * 255).astype(np.uint8), cv2.COLORMAP_JET)  # BGR
    original_bgr = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR)
    blended = cv2.addWeighted(original_bgr, 0.6, heat_color, 0.4, 0)
    cv2.imwrite(str(out_path), blended)
    return str(out_path)