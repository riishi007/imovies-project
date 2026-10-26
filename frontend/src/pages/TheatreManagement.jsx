
import React, { useEffect, useState } from 'react';
import {
  getTheatres,
  createTheatre,
  updateTheatre,
  deleteTheatre,
} from '../services/api';
import { toast } from 'react-toastify';

const emptyTheatre = {
  name: '',
  location: '',
  totalScreens: 1,
};

function TheatreManagement() {
  const [theatres, setTheatres] = useState([]);
  const [theatre, setTheatre] = useState(emptyTheatre);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchTheatres = async () => {
    try {
      const response = await getTheatres();
      setTheatres(response.data);
    } catch (error) {
      toast.error(
        error.response?.data?.message || 'Failed to load theatres.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTheatres();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setTheatre((previous) => ({
      ...previous,
      [name]: name === 'totalScreens' ? value : value,
    }));
  };

  const resetForm = () => {
    setTheatre(emptyTheatre);
    setEditingId(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!theatre.name.trim() || !theatre.location.trim()) {
      toast.error('Please enter the theatre name and location.');
      return;
    }

    const totalScreens = Number(theatre.totalScreens);

    if (!Number.isInteger(totalScreens) || totalScreens < 1) {
      toast.error('Total screens must be a positive whole number.');
      return;
    }

    const payload = {
      name: theatre.name.trim(),
      location: theatre.location.trim(),
      totalScreens,
    };

    setSaving(true);

    try {
      if (editingId) {
        await updateTheatre(editingId, payload);
        toast.success('Theatre updated successfully.');
      } else {
        await createTheatre(payload);
        toast.success('Theatre added successfully.');
      }

      resetForm();
      await fetchTheatres();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Unable to save theatre. Check your admin login and backend.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item) => {
    setTheatre({
      name: item.name,
      location: item.location,
      totalScreens: item.totalScreens,
    });
    setEditingId(item._id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this theatre?')) {
      return;
    }

    try {
      await deleteTheatre(id);
      toast.success('Theatre deleted successfully.');
      await fetchTheatres();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          'Unable to delete theatre. It may have shows assigned to it.'
      );
    }
  };

  return (
    <div className="container py-4">
      <h2 className="mb-4">Theatre Management</h2>

      <div className="card bg-secondary text-white mb-4">
        <div className="card-body">
          <h5 className="mb-3">
            {editingId ? 'Edit Theatre' : 'Add New Theatre'}
          </h5>

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">Theatre Name</label>
              <input
                className="form-control"
                type="text"
                name="name"
                value={theatre.name}
                onChange={handleChange}
                placeholder="e.g. PVR Cinemas"
                required
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Location</label>
              <input
                className="form-control"
                type="text"
                name="location"
                value={theatre.location}
                onChange={handleChange}
                placeholder="e.g. Ujjain, Madhya Pradesh"
                required
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Total Screens</label>
              <input
                className="form-control"
                type="number"
                name="totalScreens"
                min="1"
                step="1"
                value={theatre.totalScreens}
                onChange={handleChange}
                required
              />
            </div>

            <button
              className="btn btn-primary me-2"
              type="submit"
              disabled={saving}
            >
              {saving
                ? 'Saving...'
                : editingId
                  ? 'Update Theatre'
                  : 'Add Theatre'}
            </button>

            {editingId && (
              <button
                className="btn btn-light"
                type="button"
                onClick={resetForm}
              >
                Cancel
              </button>
            )}
          </form>
        </div>
      </div>

      <h4 className="mb-3">All Theatres</h4>

      {loading ? (
        <p>Loading theatres...</p>
      ) : theatres.length === 0 ? (
        <p>No theatres found. Add your first theatre above.</p>
      ) : (
        <div className="row g-3">
          {theatres.map((item) => (
            <div className="col-md-6 col-lg-4" key={item._id}>
              <div className="card bg-dark border-secondary text-white h-100">
                <div className="card-body">
                  <h5>{item.name}</h5>
                  <p className="mb-2">
                    <strong>Location:</strong> {item.location}
                  </p>
                  <p>
                    <strong>Total Screens:</strong> {item.totalScreens}
                  </p>

                  <button
                    className="btn btn-warning btn-sm me-2"
                    onClick={() => handleEdit(item)}
                  >
                    Edit
                  </button>

                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(item._id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TheatreManagement;
